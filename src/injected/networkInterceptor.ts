import {
  decodeFunctionData,
  decodeFunctionResult,
  encodeFunctionResult,
  zeroAddress,
} from "viem";
import {
  FelixAddress,
  MulticallAbi,
  MulticallAddress,
} from "../utils/multicall";
import Decimal from "decimal.js";
import { createResponse } from "../utils/response";
import { debugInfo } from "../utils/debug";
import { fetchUnifiedBalances } from "./cache";
import { publicClient } from "../utils/publicClient";

function fakeEstimateGasOrigins(origin: string) {
  const origins = ["app.hyperlend.finance", "app.storyhunt.xyz"];
  return origins.find((o) => origin.includes(o));
}

function updateTokenBalances(responseData: any, unifiedBalances: any[]) {
  const updatedResponse: any = {};

  for (const chainKey in responseData) {
    const chainData = responseData[chainKey];
    updatedResponse[chainKey] = {};

    // First, update existing tokens in the response
    for (const addressKey in chainData) {
      const tokenInfo = chainData[addressKey];
      const address = tokenInfo?.contractAddress;
      if (!address) continue;

      const varOcg = unifiedBalances.findIndex(
        (bal: any) =>
          Array.isArray(bal.breakdown) &&
          bal.breakdown.some(
            (asset: any) =>
              String(asset.contractAddress || "").toLowerCase() ===
              String(address).toLowerCase()
          )
      );

      let updatedTokenBalance = tokenInfo.tokenBalance;
      let updatedtotalUsdValue = tokenInfo.totalUsdValue;

      if (varOcg !== -1) {
        const asset = unifiedBalances[varOcg];
        const actualAsset = asset.breakdown?.find(
          (acAsset: any) =>
            String(acAsset.contractAddress || "").toLowerCase() ===
            String(address).toLowerCase()
        );

        if (asset && actualAsset) {
          try {
            updatedTokenBalance = new Decimal(asset.balance || 0)
              .mul(
                Decimal.pow(10, actualAsset?.decimals ?? asset.decimals ?? 18)
              )
              .floor()
              .toFixed();
            updatedtotalUsdValue = new Decimal(asset.balance || 0)
              .mul(tokenInfo?.price || 0)
              .toNumber();
          } catch (err) {
            console.error(`Error computing balance for ${address}:`, err);
          }
        }
      }

      updatedResponse[chainKey][addressKey] = {
        ...tokenInfo,
        tokenBalance: updatedTokenBalance,
        totalUsdValue: updatedtotalUsdValue,
      };
    }
    console.log(unifiedBalances, "unifiedBalances");

    // Then, add any missing tokens from unifiedBalances for this chain
    for (const bal of unifiedBalances) {
      for (const asset of bal.breakdown || []) {
        if (String(asset.chain.id) !== chainKey) continue;
        const addr = String(asset.contractAddress || "").toLowerCase();
        // Skip if already in response
        if (
          Object.values(updatedResponse[chainKey]).some(
            (t: any) => String(t.contractAddress || "").toLowerCase() === addr
          )
        )
          continue;

        // Add new token
        updatedResponse[chainKey][addr] = {
          contractAddress: asset.contractAddress,
          name: bal.symbol,
          symbol: bal.symbol,
          decimals: asset.decimals,
          tokenBalance: new Decimal(bal.balance || 0)
            .mul(Decimal.pow(10, asset.decimals ?? 18))
            .floor()
            .toFixed(),
          totalUsdValue: new Decimal(bal.balanceInFiat || 0).toNumber(),
          price: asset.price || 1,
          chainId: String(asset.chain.id),
          logo: asset?.chain?.logo || "",
        };
      }
    }
  }

  return updatedResponse;
}

function injectNetworkInterceptor() {
  const originalFetch = window.fetch;

  // @ts-expect-error
  window.decodeFunctionData = decodeFunctionData;
  // @ts-expect-error
  window.MulticallAbi = MulticallAbi;
  // @ts-expect-error
  window.decodeFunctionResult = decodeFunctionResult;

  window.fetch = async function (...args) {
    if (args[0].toString() === "") {
      return originalFetch.apply(this, args);
    }

    const response = await originalFetch.apply(this, args);

    if (args[0].toString().startsWith("https://api.fun.xyz/v1/assets")) {
      const responseData = await response.clone().json();
      console.log(responseData, "responseData");
      const isSimpleArrayFormat = Object.values(responseData).every((val) =>
        Array.isArray(val)
      );

      if (isSimpleArrayFormat) {
        return response;
      }

      const unifiedBalances = await fetchUnifiedBalances();
      const modifiedResponse = updateTokenBalances(
        responseData,
        unifiedBalances
      );
      console.log(modifiedResponse, "modifiedResponse");

      const headers = new Headers(response.headers);
      headers.set("content-type", "application/json;charset=utf-8");

      return new Response(JSON.stringify(modifiedResponse), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    if (args[1] && args[1].body) {
      const requestBody = args[1].body as any;
      let payloadString;
      try {
        payloadString = new TextDecoder().decode(requestBody);
      } catch (error) {
        payloadString = requestBody;
      }
      let payload;
      try {
        payload = JSON.parse(payloadString);
      } catch (error) {
        return originalFetch.apply(this, args);
      }

      if (Array.isArray(payload)) {
        const responses: any[] = [];
        const responseDatas = await response.clone().json();

        for (let i = 0; i < payload.length; i++) {
          const item = payload[i];

          if (
            item.method === "eth_call" &&
            item.params?.[0] &&
            item.params?.[0].data.toLowerCase().startsWith("0x70a08231")
          ) {
            const unifiedBalances = await fetchUnifiedBalances();
            const token = String(item.params[0]?.to).toLowerCase();
            const decodedParam = decodeFunctionData({
              abi: MulticallAbi,
              data: item.params[0].data,
            });

            if (decodedParam.functionName === "balanceOf") {
              const index = unifiedBalances.findIndex((bal) => {
                return bal.breakdown.some(
                  (asset) => asset.contractAddress.toLowerCase() === token
                );
              });

              const asset = unifiedBalances[index];

              const actualAsset = asset.breakdown.find(
                (acAsset) => acAsset.contractAddress.toLowerCase() === token
              );

              const data = encodeFunctionResult({
                abi: MulticallAbi,
                functionName: "balanceOf",
                result: BigInt(
                  new Decimal(asset.balance)
                    .mul(
                      Decimal.pow(10, actualAsset!.decimals || asset.decimals)
                    )
                    .floor()
                    .toFixed()
                ),
              });

              responses.push({
                jsonrpc: "2.0",
                id: item.id,
                result: data,
              });
            }
          } else if (
            item.method === "eth_call" &&
            item.params?.[0] &&
            (item.params[0].to?.toLowerCase() === MulticallAddress ||
              item.params[0].to?.toLowerCase() === FelixAddress)
          ) {
            const decoded = decodeFunctionData({
              abi: MulticallAbi,
              data: item.params[0].data,
            });

            const responseData = responseDatas.find(
              (r: any) => r.id === item.id
            );

            if (decoded.functionName === "aggregate3" && responseData?.result) {
              try {
                const decodedResult = decodeFunctionResult({
                  abi: MulticallAbi,
                  functionName: "aggregate3",
                  data: responseData.result,
                }) as { success: boolean; returnData: string }[];

                const params = decoded.args![0] as {
                  target: string;
                  callData: `0x${string}`;
                  allowFailure: boolean;
                }[];

                const unifiedBalances = await fetchUnifiedBalances();

                params.forEach((param, pIndex) => {
                  try {
                    const decodedParam = decodeFunctionData({
                      abi: MulticallAbi,
                      data: param.callData,
                    });

                    if (decodedParam.functionName !== "balanceOf") return;

                    const index = unifiedBalances.findIndex((bal) => {
                      return bal.breakdown.some(
                        (asset) =>
                          asset.contractAddress.toLowerCase() ===
                          param.target.toLowerCase()
                      );
                    });

                    if (index === -1) return;

                    const asset = unifiedBalances[index];

                    const actualAsset = asset.breakdown.find(
                      (token) =>
                        token.contractAddress.toLowerCase() ===
                        param.target.toLowerCase()
                    );

                    decodedResult[pIndex].returnData = encodeFunctionResult({
                      abi: MulticallAbi,
                      functionName: "balanceOf",
                      result: BigInt(
                        new Decimal(asset.balance)
                          .mul(
                            Decimal.pow(
                              10,
                              actualAsset!?.decimals || asset.decimals
                            )
                          )
                          .floor()
                          .toFixed()
                      ),
                    });
                  } catch (error) {
                    return decodedResult[pIndex];
                  }
                });

                const modifiedResult = encodeFunctionResult({
                  abi: MulticallAbi,
                  functionName: "aggregate3",
                  result: decodedResult,
                });

                responses.push({
                  jsonrpc: "2.0",
                  id: item.id,
                  result: modifiedResult,
                });
              } catch (error) {
                responses.push({
                  jsonrpc: "2.0",
                  id: item.id,
                  result: responseData.result,
                });
              }
            } else if (decoded.functionName === "deposit" && decoded.args) {
              try {
                const unifiedBalancess = await fetchUnifiedBalances();
                const paramToken = await publicClient.readContract({
                  address: item?.params[0]?.to,
                  abi: MulticallAbi,
                  functionName: "asset",
                });

                const index = unifiedBalancess.findIndex((bal) => {
                  return bal.breakdown.some(
                    (asset) =>
                      asset.contractAddress.toLowerCase() ===
                      String(paramToken)?.toLowerCase()
                  );
                });

                const asset = unifiedBalancess[index];

                const actualAsset = asset?.breakdown.find(
                  (token) =>
                    token.contractAddress?.toLowerCase() ===
                    String(paramToken)?.toLowerCase()
                );

                const modifiedResult = encodeFunctionResult({
                  abi: MulticallAbi,
                  functionName: "deposit",
                  result: BigInt(
                    new Decimal(actualAsset!.balance)
                      .mul(
                        Decimal.pow(
                          10,
                          actualAsset!.decimals || asset?.decimals
                        )
                      )
                      .floor()
                      .toFixed()
                  ),
                });

                responses.push({
                  jsonrpc: "2.0",
                  id: item.id,
                  result: modifiedResult,
                });
              } catch (error) {
                responses.push({
                  jsonrpc: "2.0",
                  id: item.id,
                  result: responseData?.result,
                });
              }
            } else {
              responses.push({
                jsonrpc: "2.0",
                id: item.id,
                result: responseData?.result,
              });
            }
          } else if (item.method === "eth_getBalance" && item.params?.[0]) {
            const unifiedBalances = await fetchUnifiedBalances();

            const asset = unifiedBalances.find((asset) =>
              asset.breakdown.find(
                (b) => b.chain.id === 999 && b.contractAddress === zeroAddress
              )
            );

            if (asset) {
              responses.push({
                jsonrpc: "2.0",
                id: item.id,
                result: new Decimal(asset.balance || 0)
                  .mul(Decimal.pow(10, 18))
                  .toHexadecimal(),
              });
            }
          }
        }

        if (responses.length === payload.length) {
          return createResponse(responses);
        }
      }

      if (
        payload.method === "eth_estimateGas" &&
        payload.params?.[0] &&
        (payload.params[0].data.toLowerCase().startsWith("0xe28c8be3") ||
          payload.params[0].data.toLowerCase().startsWith("0xf24f0847") ||
          payload.params[0].data.toLowerCase().startsWith("0xac9650d8"))
      ) {
        if (fakeEstimateGasOrigins(window.origin)) {
          return createResponse({
            jsonrpc: "2.0",
            id: payload.id,
            result: new Decimal(1_000_000).toHexadecimal(),
          });
        }
      }

      if (
        payload.method === "eth_call" &&
        payload.params?.[0] &&
        payload.params?.[0].data.toLowerCase().startsWith("0x70a08231")
      ) {
        const unifiedBalances = await fetchUnifiedBalances();
        const token = String(payload.params?.[0].to).toLowerCase();
        const decodedParam = decodeFunctionData({
          abi: MulticallAbi,
          data: payload.params[0].data,
        });

        if (decodedParam.functionName === "balanceOf") {
          const index = unifiedBalances.findIndex((bal) => {
            return bal.breakdown.some(
              (asset) => asset.contractAddress.toLowerCase() === token
            );
          });

          const asset = unifiedBalances[index];

          const actualAsset = asset.breakdown.find(
            (acAsset) => acAsset.contractAddress.toLowerCase() === token
          );

          const data = encodeFunctionResult({
            abi: MulticallAbi,
            functionName: "balanceOf",
            result: BigInt(
              new Decimal(asset.balance)
                .mul(Decimal.pow(10, actualAsset!.decimals || asset.decimals))
                .floor()
                .toFixed()
            ),
          });

          return createResponse({
            jsonrpc: "2.0",
            id: payload.id,
            result: data,
          });
        }
      }

      if (payload.method === "eth_getBalance" && payload.params?.[0]) {
        const unifiedBalances = await fetchUnifiedBalances();
        const chainIdHex = await window.ethereum.request({
          method: "eth_chainId",
        });
        const chainId = parseInt(String(chainIdHex), 16);
        const ETH = unifiedBalances?.find((asset: any) =>
          asset.breakdown.find(
            (b: any) =>
              b.contractAddress === zeroAddress &&
              b.chain.id === Number(chainId)
          )
        );

        if (ETH) {
          return createResponse({
            jsonrpc: "2.0",
            id: payload.id,
            result: new Decimal(ETH.balance)
              .mul(Decimal.pow(10, 18))
              .toHexadecimal(),
          });
        }
      }

      if (
        payload.method === "eth_call" &&
        payload.params?.[0] &&
        payload.params[0].to?.toLowerCase() === MulticallAddress
      ) {
        const decoded = decodeFunctionData({
          abi: MulticallAbi,
          data: payload.params[0].data,
        });

        if (decoded.functionName === "balanceOf") {
          debugInfo("BALANCE OF CALLED", decoded);
        }

        if (decoded.functionName === "aggregate3") {
          const responseData = await response.clone().json();

          if (!responseData.result) {
            debugInfo(
              "No result in aggregate3 response, returning original response"
            );
            return response;
          }
          try {
            const decodedResult = decodeFunctionResult({
              abi: MulticallAbi,
              functionName: "aggregate3",
              data: responseData.result,
            }) as { success: boolean; returnData: string }[];
            const params = decoded.args![0] as {
              target: string;
              callData: `0x${string}`;
              allowFailure: boolean;
            }[];

            const unifiedBalances = await fetchUnifiedBalances();

            params.forEach((param, pIndex) => {
              try {
                const decodedParam = decodeFunctionData({
                  abi: MulticallAbi,
                  data: param.callData,
                });

                if (decodedParam.functionName === "getUserWalletBalances") {
                  const balanceResult: any = decodeFunctionResult({
                    abi: MulticallAbi,
                    functionName: "getUserWalletBalances",
                    data: decodedResult[pIndex]?.returnData as `0x${string}`,
                  });

                  for (let i = 0; i < balanceResult[0].length; i++) {
                    const tokenAddress = balanceResult[0][i].toLowerCase();

                    const asset = unifiedBalances.find((bal) =>
                      bal.breakdown.some(
                        (asset) =>
                          asset.contractAddress.toLowerCase() ===
                          tokenAddress.toLowerCase()
                      )
                    );

                    if (asset) {
                      balanceResult[1][i] = BigInt(
                        new Decimal(asset?.balance)
                          .mul(Decimal.pow(10, asset.decimals))
                          .floor()
                          .toFixed()
                      );
                    }
                  }

                  decodedResult[pIndex].returnData = encodeFunctionResult({
                    abi: MulticallAbi,
                    functionName: "getUserWalletBalances",
                    result: balanceResult,
                  });
                }

                if (decodedParam.functionName !== "balanceOf") {
                  return;
                }

                const index = unifiedBalances.findIndex((bal) => {
                  return bal.breakdown.some(
                    (asset) =>
                      asset.contractAddress.toLowerCase() ===
                      param.target.toLowerCase()
                  );
                });
                if (index === -1) {
                  return;
                }
                const asset = unifiedBalances[index];

                const actualAsset = asset.breakdown.find(
                  (token) =>
                    token.contractAddress.toLowerCase() ===
                    param.target.toLowerCase()
                );

                decodedResult[pIndex].returnData = encodeFunctionResult({
                  abi: MulticallAbi,
                  functionName: "balanceOf",
                  result: BigInt(
                    new Decimal(asset.balance)
                      .mul(
                        Decimal.pow(10, actualAsset!.decimals || asset.decimals)
                      )
                      .floor()
                      .toFixed()
                  ),
                });
              } catch (error) {
                // console.log(
                //   "Failed to decode callData for target:",
                //   param.target,
                //   "Error:",
                //   error
                // );
              }
            });
            const modifiedResult = encodeFunctionResult({
              abi: MulticallAbi,
              functionName: "aggregate3",
              result: decodedResult,
            });

            return createResponse({
              jsonrpc: "2.0",
              id: payload.id,
              result: modifiedResult,
            });
          } catch (e) {
            console.log(e, "error");
            // debugInfo(
            //   "error occured, falling back to send original response",
            //   e
            // );
            return response;
          }
        }
      }
    }
    return response;
  };
}

injectNetworkInterceptor();
