// ==UserScript==
// @name         Auth0-Login
// @namespace    LazaroOnline
// @version      1.0
// @description  Auto-fill in the MFA token during login.
// @author       Lazaro M
// @match        https://auth0.auth0.com/u/login/identifier*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=auth0.com
// @grant        unsafeWindow
// ==/UserScript==

//____________________________________________________________________________________________________

const config = {
    retryPeriodMilliseconds: 800
   ,userEmail: "PASTE_YOUR_EMAIL_HERE"
   ,autoClickButtonToSubmit: false // Auto-clicks the "Continue" button.
}

const selectors = {
    emailInput: "input#username"
   ,submitButton: "button[type='submit'][value='default']"
}

const scriptName = "Auth0-Login";

function fillInputEmail() {
    var input = document.querySelector(selectors.emailInput)
    if (input != null) {
        var email = config.userEmail;
        setReactInputValue(input, email)

        input.value = email
        input.dispatchEvent(new Event('change', { 'bubbles': true }))
        return true
    }
    return false
}

function submitForm() {
    var submitButton = document.querySelector(selectors.submitButton)
    submitButton?.click()
}

async function fillInputEmailAndSubmit() {
    console.log(`${scriptName}: Trying to find "${selectors.emailInput}"...`)
    success = fillInputEmail()
    if (config.autoClickButtonToSubmit) {
        submitForm()
    }
}

function setReactInputValue(input, newValue) {
    // https://stackoverflow.com/questions/52120524/type-text-into-a-react-input-using-javascript-tampermonkey-script/59599339#59599339
    // https://stackoverflow.com/questions/23892547/what-is-the-best-way-to-trigger-change-or-input-event-in-react-js#46012210
    const prevValue = input.value;
    input.value = newValue;
    // NOTE: For other DOM types like "select", the event should be "change" instead of "input".
    const event = new Event("input", { bubbles: true });
    event.simulated = true; // For React15
    const tracker = input._valueTracker; // For React16
    if (tracker) {
        tracker.setValue(prevValue);
    }
    input.dispatchEvent(event);
}

function docReady(fn) {
    if (document.readyState === "complete" ||
        document.readyState === "interactive")
    {
      setTimeout(fn, 1); // call on next available tick
    } else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}

(function() {
    console.log(`${scriptName}: Script starting...`)
    docReady(fillInputEmailAndSubmit);
})();
