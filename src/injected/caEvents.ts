import { NexusSDK } from "@avail-project/nexus";

function createDiv(exampleDiv: HTMLDivElement, id: string, event: string) {
  const div = document.createElement("div");
  exampleDiv.getAttributeNames().forEach((attr) => {
    div.setAttribute(attr, exampleDiv.getAttribute(attr)!);
  });
  div.id = id;
  div.dataset.event = event;
  return div;
}

function updateModalTitleDescription(title: string, desc?: string) {
  const modal = document.querySelector(".modal")!;
  const mainDiv =
    modal.children[1].children[0].children[0].children[1].children[0];
  mainDiv.children[0].innerHTML = title;
  if (desc) mainDiv.children[1].innerHTML = desc;
}

let isListening = false;

export function setCAEvents(ca: NexusSDK) {
  if (isListening) {
    return;
  }
  isListening = true;

  const state = {
    steps: [] as {
      typeID: string;
      type: string;
      done: boolean;
      data?: any;
    }[],
    currentSource: 0,
    totalSources: 0,
    currentAllowance: 0,
    totalAllowances: 0,
  };

  ca.nexusEvents.on("expected_steps", (data) => {
    const modal = document.querySelector(".modal")!;
    if (modal && modal.children) {
      const mainDiv =
        modal.children[1].children[0].children[0].children[1].children[1];
      if (mainDiv.children.length > 3) {
        return;
      }
      state.steps = data.map((s: { typeID: number }) => ({
        ...s,
        done: false,
      }));
      state.currentSource = 0;
      state.totalSources = 0;
      state.currentAllowance = 0;
      state.totalAllowances = 0;

      const exampleDiv =
        mainDiv.children.length === 3
          ? (mainDiv.children[1] as HTMLDivElement)
          : (mainDiv.children[0] as HTMLDivElement);
      mainDiv.setAttribute(
        "style",
        mainDiv.getAttribute("style")!.replace("hidden", "visible")
      );
      const style = document.createElement("style");
      style.innerHTML = `
    .loader {
      animation: l1 0.6s linear infinite alternate;
    }
    @keyframes l1 {to{opacity: 0.6; color: rgb(80, 210, 193)}}
    `;
      mainDiv.append(style);
      state.steps.forEach((s) => {
        switch (s.type) {
          case "ALLOWANCE_ALL_DONE": {
            const div = createDiv(exampleDiv, s.typeID, s.type);
            div.id = "intent-allowances";
            div.innerHTML = `
          <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(255, 255, 255); text-align: center; display: block;" bis_skin_checked="1">Setting up Allowances</div>
          <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(148, 158, 156); text-align: center; display: block;" bis_skin_checked="1">0/${state.totalAllowances}</div>
          `;
            mainDiv.insertBefore(div, exampleDiv);
            break;
          }
          case "ALLOWANCE_USER_APPROVAL": {
            ++state.totalAllowances;
            break;
          }
          case "INTENT_SUBMITTED": {
            const div = createDiv(exampleDiv, s.typeID, s.type);
            div.id = "intent-submitted";
            div.innerHTML = `
          <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(255, 255, 255); text-align: center; display: block;" bis_skin_checked="1">Verifying Intent</div>
          <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(148, 158, 156); text-align: center; display: block;" bis_skin_checked="1">Not Verified</div>
          `;
            mainDiv.insertBefore(div, exampleDiv);
            break;
          }
          case "INTENT_COLLECTION": {
            state.totalSources = s.data.total;
            break;
          }
          case "INTENT_COLLECTION_COMPLETE": {
            const div = createDiv(exampleDiv, s.typeID, s.type);
            div.id = "intent-collection";
            div.innerHTML = `
          <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(255, 255, 255); text-align: center; display: block;" bis_skin_checked="1">Collecting from Sources</div>
          <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(148, 158, 156); text-align: center; display: block; font-weight: bold" bis_skin_checked="1">0/${state.totalSources}</div>
          `;
            mainDiv.insertBefore(div, exampleDiv);
            break;
          }
          case "INTENT_FULFILLED": {
            const div = createDiv(exampleDiv, s.typeID, s.type);
            div.id = "intent-fulfilled";
            div.innerHTML = `
          <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(255, 255, 255); text-align: center; display: block;" bis_skin_checked="1">Supplying to Destination</div>
          <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(148, 158, 156); text-align: center; display: block;" bis_skin_checked="1">Not Supplied</div>
          `;
            mainDiv.insertBefore(div, exampleDiv);
            break;
          }
          default:
            break;
        }
      });
      updateModalTitleDescription("Signing Intent");
    }
  });

  ca.nexusEvents.on("step_complete", (data) => {
    const modal = document.querySelector(".modal")!;
    const mainDiv =
      modal.children[1].children[0].children[0].children[1].children[1];
    switch (data.type) {
      case "ALLOWANCE_ALL_DONE": {
        updateModalTitleDescription("Allowances setup done");
        const allowanceDiv = mainDiv.querySelector("#intent-allowances");
        if (allowanceDiv) {
          allowanceDiv.innerHTML = `
          <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(255, 255, 255); text-align: center; display: block;" bis_skin_checked="1">Allowances Setup Done</div>
          <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(80, 210, 193) !important; text-align: center; display: block;" bis_skin_checked="1">${state.totalAllowances}/${state.totalAllowances}</div>
          `;
        }
        break;
      }
      case "ALLOWANCE_USER_APPROVAL": {
        updateModalTitleDescription(
          `Setting up allowances on ${data.data.chainName}`
        );
        const allowanceDiv = mainDiv.querySelector("#intent-allowances");
        if (allowanceDiv) {
          allowanceDiv.children[0].classList.add("loader");
        }
        break;
      }
      case "ALLOWANCE_APPROVAL_MINED": {
        const allowanceDiv = mainDiv.querySelector("#intent-allowances");
        if (allowanceDiv) {
          allowanceDiv.innerHTML = `
          <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(255, 255, 255); text-align: center; display: block;" bis_skin_checked="1">Allowances Setup Done</div>
          <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(80, 210, 193) !important; text-align: center; display: block;" bis_skin_checked="1">${++state.currentAllowance}/${
            state.totalAllowances
          }</div>
          `;
        }
        break;
      }
      case "INTENT_ACCEPTED": {
        updateModalTitleDescription("Submitting Intent");
        const allowanceDiv = mainDiv.querySelector("#intent-submitted");
        if (allowanceDiv) {
          allowanceDiv.children[0].classList.add("loader");
        }
        break;
      }
      case "INTENT_SUBMITTED": {
        updateModalTitleDescription("Collecting from Sources");
        const intentDiv = mainDiv.querySelector("#intent-submitted");
        if (intentDiv) {
          intentDiv.innerHTML = `
        <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(255, 255, 255); text-align: center; display: block;" bis_skin_checked="1">Intent Verified</div>
        <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(80, 210, 193) !important; text-align: center; display: block;" bis_skin_checked="1"><a href="${data.data.explorerURL}" style="text-decoration: underline; color: currentColor" target="_blank">View Intent</a></div>
        `;
        }
        const collectionDiv = mainDiv.querySelector("#intent-collection");
        if (collectionDiv) {
          collectionDiv.children[0].classList.add("loader");
        }
        // explorerURL = data.data.explorerURL;
        break;
      }
      case "INTENT_COLLECTION": {
        const intentDiv = mainDiv.querySelector("#intent-collection");
        if (intentDiv) {
          intentDiv.innerHTML = `
        <div class="sc-bjfHbI jxtURp body12Regular loader" style="color: rgb(255, 255, 255); text-align: center; display: block;" bis_skin_checked="1">Collecting from Sources</div>
        <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(80, 210, 193); text-align: center; display: block; font-weight: bold" bis_skin_checked="1">${++state.currentSource}/${
            state.totalSources
          }</div>
        `;
        }
      }
      case "INTENT_COLLECTION_COMPLETE": {
        updateModalTitleDescription("Supplying Liquidity");
        const intentDiv = mainDiv.querySelector("#intent-collection");
        if (intentDiv) {
          intentDiv.innerHTML = `
        <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(255, 255, 255); text-align: center; display: block;" bis_skin_checked="1">Collected from Sources</div>
        <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(80, 210, 193); text-align: center; display: block; font-weight: bold" bis_skin_checked="1">${state.totalSources}/${state.totalSources}</div>
        `;
        }
        const collectionDiv = mainDiv.querySelector("#intent-fulfilled");
        if (collectionDiv) {
          collectionDiv.children[0].classList.add("loader");
        }
        break;
      }
      case "INTENT_FULFILLED": {
        updateModalTitleDescription("Depositing to HyperLiquid");
        const intentDiv = mainDiv.querySelector("#intent-fulfilled");
        if (intentDiv) {
          intentDiv.innerHTML = `
        <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(255, 255, 255); text-align: center; display: block;" bis_skin_checked="1">Supplied to Destination</div>
        <div class="sc-bjfHbI jxtURp body12Regular" style="color: rgb(80, 210, 193); text-align: center; display: block; font-weight: bold" bis_skin_checked="1">Done</div>
        `;
        }
        break;
      }
      default:
        break;
    }
    const v = state.steps.find((s) => {
      return s.typeID === data.typeID;
    });
    if (v) {
      v.done = true;
    }
  });
}

export function unsetCAEvents(ca: NexusSDK) {
  ca.nexusEvents.removeAllListeners();
}
