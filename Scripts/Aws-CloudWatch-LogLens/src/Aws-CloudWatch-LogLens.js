// ==UserScript==
// @name         Aws-CloudWatch-LogLens
// @namespace    Aws
// @version      1
// @description  Convert aws log fields into links that provides further info. TimeLens makes CloudWatch timestamps into links to filter the logs around the same time. IpLens opens a link to the IP geolocation and info.
// @author       Lazaro M
// @match        https://*.console.aws.amazon.com/cloudwatch/home*
// @match        https://*.console.aws.amazon.com/xray/home*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=amazon.com
// @grant        none
// ==/UserScript==

/*
HOW THIS WORKS:
This script scans the DOM and its iframes every 5 seconds searching for the configured element selectors,
then it runs the configured rules and adds links to related info when the rule matches.
To prevent impacting the page performance for efficiency,
it adds data-attributes as cache to identify fields that have been already processed.
But XRay results table changes the content of the fields dynamically during column reordering and it doesn't remove the cached attributes,
so it also has to observe those DOM changes to clear the cache stored as data attributes in the DOM elements.
If anything goes wrong, the user can still double-click or right-click a cell
to clear the cache attribute and force it to be processed again in the next few seconds.

HOW TO TEST:
XRay + Column-Reordering: filter by "Client IP"
CloudWatch: with "fields @timestamp"
CloudWatch: with Step-Functions
CloudWatch: with a column that contains single IPs.

*/

const attributePrefix = "LZ-Aws-CloudWatch-LogLens-"
const selectors = {
  addOn: {
    attributePrefix: attributePrefix,
    alreadySetRuleAttribute: attributePrefix + "rule-",
    alreadySetObserver: attributePrefix + "addObserveDomOnce-runLogRules",
  },
  cloudWatch:{
    resultsField: "table.logs-table .logs-table__body-cell"
  },
  xRay: {
     resultsTable:  ".data-table--tracelist"
    ,resultsTable2: ".awsui-table-container"
    ,resultsField:  ".data-table--tracelist .ReactVirtualized__Table__rowColumn"
    ,resultsField2: ".awsui-table-container span>span"
  }
}

const config = {
  executionInterval: 5 * 1000,
  observeChanges: [
    selectors.xRay.resultsTable,
    selectors.xRay.resultsTable2
  ],
  fieldUrlRules: [
    {
       name: "TimeLens"
      ,selectorList: [ selectors.cloudWatch.resultsField ]
      ,matchFunc: (el) => isTimestamp(el.innerText?.trim())
      ,action: (el) => setFieldLink(getCloudWatchTimeLensUrl, el)
    },
    {
       name: "IpLens"
      ,selectorList: [
         selectors.cloudWatch.resultsField
        ,selectors.xRay.resultsField
        ,selectors.xRay.resultsField2
      ]
      ,matchFunc: (el) => isIpV4(el.innerText?.trim())
      ,action: (el) => setFieldLink(getIpInfoUrl, el)
    },
    {
       name: "StepFunctionExecutionLens"
      ,selectorList: [ selectors.cloudWatch.resultsField ]
      ,matchFunc: (el) => isStepFunctionArn(el.innerText?.trim())
      ,action: (el) => AddLinkButton(getCloudWatchStepFunctionExecutionLogsUrl, el, "", "Open new window with this Execution-ARN filter.")
      //,action: (el) => setFieldLink(getCloudWatchStepFunctionExecutionLogsUrl, el)
      // For updating the filter within the same page, it would be required to find a way to edit the query's monaco-editor text.
      //,action: (el) => addCloudWatchFilterExecutionArn(el)
    },
  ]
}

// #region TimeLens

// Examples:
// 2023-07-25T17:26:19.517Z
// 2000-01-01T22:59:59.123+02:00
const isTimestamp = (text) => /^(\d){4}-(\d){2}-(\d){2}T(\d){2}:(\d){2}:(\d){2}\.?(\d)*(.(\d)*\:(\d)*)?Z?$/.test(text);


function getCloudWatchTimeLensUrl(timestamp) {
  var date = new Date(timestamp);
  var { dateStart, dateEnd } = getDateRange(date, 3, 1);
  var urlHash = getCloudWatchUrlHash(dateStart, dateEnd, { filter: "" }) // TODO: add current filter?
  return window.location.origin
       + window.location.pathname
       + window.location.search
       + urlHash;
}

function getCloudWatchUrlHash(dateStart, dateEnd) {
  var dateStartCloudWatch = dateToCloudWatchParam(dateStart);
  var dateEndCloudWatch = dateToCloudWatchParam(dateEnd);
  // Url Hash Examples:
  // #logsV2:logs-insights$3FqueryDetail$3D~(end~'2020-12-30T21*3a59*3a59.000Z~start~'2020-12-30T23*3a59*3a59.000Z~timeType~'ABSOLUTE~tz~'UTC~editorString~'fields*20*40timestamp*2c*20*40message*0a*7c*20filter*20*40message*20like*20*27something-to-filter-out*27*0a*7c*20limit*202002~queryId~'1234567890abcdef-12345678-1234567-1234567-1234567890abcdef0123456~source~(~'some-log-group1~'some-log-group2))
  // #logsV2:logs-insights$3FqueryDetail$3D~(end~'2023-07-21T21*3a59*3a59.000Z~start~'2023-07-19T22*3a00*3a00.000Z~timeType~'ABSOLUTE~tz~'Local~editorString~'fields*20*40timestamp*2c*20*40message*2c*20*40logStream*2c*20*40log*0a*7c*20filter*20*40message*20not*20like*20*27something-to-filter-out*27*0a*7c*20limit*202002~queryId~'1234567890abcdef-12345678-1234567-1234567-1234567890abcdef0123456~source~(~'some-log-group1~'some-log-group2))
  // #logsV2:logs-insights$3FqueryDetail$3D~(end~0~start~-172800~timeType~'RELATIVE~unit~'seconds~editorString~'fields*20*40timestamp*2c*20*40message*2c*20*40logStream*2c*20*40log*0a*7c*20filter*20*40message*20not*20like*20*27something-to-filter-out*27*0a*7c*20limit*202002~queryId~'1234567890abcdef-12345678-1234567-1234567-1234567890abcdef0123456~source~(~'some-log-group1))
  var replaceDateBy = `end~'${dateEndCloudWatch}~start~'${dateStartCloudWatch}~timeType~'${cloudWatchUrl.TimeTypes.absoluteUtc}~`;
  var hash = window.location.hash
    .replace(/end\$257E.*?timeType\$257E.*?\$257E.*?\$257E.*?\$257E/, replaceDateBy)
    .replace(/end~.*~timeType~.*?~.*?~.*?~/, replaceDateBy)
  if (hash == window.location.hash) {
    console.log("ERROR: could not replace url time!");
  }
  return hash;
}

const cloudWatchUrl = {
  TimeTypes: {
     absoluteUtc: "ABSOLUTE~tz~'UTC"
    ,absoluteLocal: "ABSOLUTE~tz~'Local"
    ,relative: "RELATIVE~unit~'seconds"
  }
  ,delimiter: "~"
  ,paramName: {
     logQuery: "editorString~'"
    ,dateEnd: "end~'"
    ,dateStart: "start~'"
    ,dateType: "timeType~'"
    ,dateTimezone: "tz~'"
    ,queryId: "queryId~'"
    //,source: "source~(" // This is an array
  }
}

function getDateRange(date, secondsBefore = 3, secondsAfter = 1) {
  var dateStart = new Date(date).addSeconds(-secondsBefore);
  var dateEnd = new Date(date).addSeconds(secondsAfter);
  return { dateStart, dateEnd };
}

Date.prototype.addSeconds = function (s) {
  this.setTime(this.getTime() + s * 1000);
  return this;
}

function dateToCloudWatchParam(date) {
  // CW url date format: "2022-02-02T10*3a14*3a50.000Z"
  return encodeURICloudWatchFilter(date.toISOString());
}

function getCurrentLogQueryFromUrl(url = window.location.hash) {
  var logQueryEncoded = url?.replace(/.*~editorString~'(.*?)~.*/, "$1");
  var logQuery = decodeURICloudWatchFilter(logQueryEncoded);
  return logQuery;
}

// This special encoding was only observed in CloudWatch filters (not in the old X-Ray console prior to 2022)
const encodeURICloudWatchFilter = (str) => encodeURIComponentForRFC3986(str)
  .encodeURISpecialCharacters(uriExtraSpecialCharsInCloudWatchFilter)
  .replace(/%/g, "*");

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent#description
// https://www.w3schools.com/tags/ref_urlencode.ASP
const encodeURIComponentForRFC3986 = (str) => encodeURIComponent(str).encodeURISpecialCharacters(uriExtraSpecialCharsInRFC3986);

const uriExtraSpecialCharsInRFC3986 = "!'()*";
const uriExtraSpecialCharsInCloudWatchFilter = "~";
const encodeURISpecialCharacter = (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`;

String.prototype.encodeURISpecialCharacters = function (specialChars) {
  return this?.replace(new RegExp(`[${specialChars}]`, 'g'), encodeURISpecialCharacter);
}

function decodeURICloudWatchFilter(cloudWatchUrlFilterEncoded) {
  var escapedSpecialChars = Array.from(uriExtraSpecialCharsInRFC3986).map(c => {
    return { decoded: c, encoded: encodeURISpecialCharacter(c)}}
  );
  var cloudWatchUrlFilter = cloudWatchUrlFilterEncoded;
  escapedSpecialChars.forEach(escapedCharString => {
    cloudWatchUrlFilter = cloudWatchUrlFilter.replaceAll(escapedCharString.encoded, escapedCharString.decoded);
  });
  cloudWatchUrlFilter = cloudWatchUrlFilter.replace(/\*/g, "%");
  cloudWatchUrlFilter = decodeURIComponent(cloudWatchUrlFilter);
  return cloudWatchUrlFilter;
}

function htmlEscape(text) {
  // https://stackoverflow.com/questions/1219860/html-encoding-lost-when-attribute-read-from-input-field/7124052#7124052
  return text?.replaceAll("&", '&amp;')
              .replaceAll("\"",'&quot;')
              .replaceAll("'", '&#39;')
              .replaceAll("<", '&lt;')
              .replaceAll(">", '&gt;')
              .replaceAll("/", '&#x2F;')
              .replaceAll("\r\n",    '&#10;')
              .replaceAll(/[\r\n]/g, '&#10;');
}

// #endregion

// #region IpLens

const isIpV4 = (ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip); // https://stackoverflow.com/questions/4460586/javascript-regular-expression-to-check-for-ip-addresses
const ipInfoUrl = "https://tools.keycdn.com/geo?host=";
const getIpInfoUrl = (ip) => ipInfoUrl + ip;

// #endregion

// #region StepFunctionExecutionLens

const stepFunctionArnPrefix = "arn:aws:states:";

function isStepFunctionArn(text) {
  return text == null? false :
         text.trim().startsWith(stepFunctionArnPrefix)
     && !text.trim().includes(" ");
}

// #region StepFunctionExecutionArn-FilterEdit

function addCloudWatchFilterExecutionArn(element) {
  var arn = element.innerText?.trim();
  //var currentLogQuery = getCurrentLogQuery();
  var currentLogQuery = getCurrentLogQueryFromUrl();
  var filter = ` execution_arn = '${arn}' `;
  var newLogQuery = addLogQueryFilter(currentLogQuery, filter);
  replaceLogQuery()
}

function getCurrentLogQuery() {
  // return document.querySelector("awsui-form-field").innerText; // This doesn't work.
  // TODO:implement
}

// #endregion

function getCloudWatchStepFunctionExecutionLogsUrl(arn) {
  var currentUrl = window.location.href;
  var currentLogQuery = getCurrentLogQueryFromUrl(currentUrl);
  var filter = ` execution_arn = '${arn}' `;
  var newLogQuery = addLogQueryFilter(currentLogQuery, filter);
  var newUrl = changeCloudWatchUrlQuery(newLogQuery);
  return newUrl;
}

function addLogQueryFilter(logQuery, filter) {
  // This method is approximate for most common use-cases, it will never be perfect.
  var newLogQuery = logQuery;
  // Note: log filter new lines are just "\n".
  var hasFilter = /\s*\|?\s*filter\s+@message\s+.*?[\n$]/i.test(logQuery);
  if (hasFilter) {
    newLogQuery = logQuery.replace(/(\s*\|?\s*filter\s+@message\s+.*?[\n$])/i, "$1 \n or " + filter + "\n");
  }
  else {
    newLogQuery = logQuery += "\n| filter " + filter + "\n";
  }
  return newLogQuery;
}

function changeCloudWatchUrlQuery(newLogQuery, cloudWatchUrlWithLogQuery = window.location.href) {
  // Here it is warrantied that the url contains a log query
  return cloudWatchUrlWithLogQuery?.replace(/~editorString~'(.*?)~/,
    `~editorString~'${encodeURICloudWatchFilter(newLogQuery)}~`
    //`${cloudWatchUrl.delimiter}${cloudWatchUrl.paramName.logQuery}${encodeURICloudWatchFilter(newLogQuery)}${cloudWatchUrl.paramName.delimiter}`
  );
}

// #endregion
// #region Engine

window.enableScriptAwsCloudWatchTimeLensLogs = true;
const consoleLogPrefix = "Script-Aws-CloudWatch-LogLens"
function consoleLog(text, obj = undefined) {
  var logText = consoleLogPrefix + ":  " + text;
  if (window.enableScriptAwsCloudWatchTimeLensLogs) {
    if (obj === undefined) {
      console.log(logText);
    } else {
      console.log(logText, obj);
    }
  }
}

let areRulesRunning = false;

function runLogLens() {
  runAllLogRules();
  addParentChangeObservers();
}

function runAllLogRules() {
  areRulesRunning = true;
  try {
    consoleLog("Running all log rules...");
    for (let rule of config.fieldUrlRules) {
      runLogRule(rule);
    }
  } catch(ex) {
    throw ex;
  }
  finally {
    areRulesRunning = false;
  }
  //consoleLog(`Run all log rules FINISHED.`);
}

function runLogRule(rule) {
  //consoleLog(`Running rule '${rule.name}' ...`);
  var elements = getMatchingElements(rule.selectorList, rule.matchFunc,  rule.name);
  for (var element of elements) {
    rule.action(element);
    setResetDataAttributesOnDoubleClick(element);
    //addObserveDomOnce(element, () => isMatchField(element, rule.matchFunc, rule.name) ? rule.action(element) : null);
  }
  if (elements.length <= 0) { return; }
  consoleLog(`Rule '${rule.name}' found ${elements.length} elements.`);
}

// #region Engine-ChangeObserver

function addParentChangeObservers() {
  if (config.observeChanges?.length > 0) {
    for (var observeChangesSelector of config.observeChanges) {
      var changeObserverElements = querySelectorAllIncludingIframes(observeChangesSelector);
      changeObserverElements.forEach(element => {
        addObserveDomOnce(element, () => {
          if (areRulesRunning) {
            consoleLog("Observed DOM changes, but rules are running...");
          } else {
            resetDataAttributesWithin(element);
          }
        })
      });
    }
  }
}

function addObserveDomOnce(element, func, funcName = selectors?.addOn?.alreadySetObserver + "addObserveDomOnce") {
  executeOnce(element, funcName, () => {
    let isExecutingDomUpdate = false;
    observeDOM(element, () => {
      if (!isExecutingDomUpdate) {
        isExecutingDomUpdate = true;
        func();
        consoleLog("Updating observed Dom", element);
        setTimeout(() => { isExecutingDomUpdate = false; }, 1);  // call on next available tick
      } else { consoleLog("(stopped updating observed dom)"); }
    });
    consoleLog("Observing Dom", element);
  });
}

function executeOnce(element, funcName = "executeOnce", func) {
  var controlAttributeName = funcName;
  var controlAttributeValue = element.getAttribute(controlAttributeName);
  if (controlAttributeValue == null) {
    element.setAttribute(controlAttributeName, true);
    func();
  }
}

function setResetDataAttributesOnDoubleClick(element) {
  // Prevent breaking possible page functionality or adding the event multiple times.
  if (element.ondblclick == null) {
    element.ondblclick = () => resetDataAttributes(element);
  //This may be more performant or may this prevent possible memory leaks (?)
  //However the event.srcElement may be an inner element, so additional logic is required to check the parent elements.
  //element.ondblclick = resetDataAttributesEvent;
  }
  //For those who prefer to use right click to reset the attributes.
  //Because sometimes you cannot double-click a link.
  if (element.onauxclick == null) {
    element.onauxclick = () => resetDataAttributes(element);
  //element.onauxclick = resetDataAttributesEvent;
  }
}

function resetDataAttributesEvent(event) {
  resetDataAttributes(event.srcElement);
  resetDataAttributes(event.srcElement?.parentElement);
  resetDataAttributes(event.srcElement?.parentElement?.parentElement);
}

function resetDataAttributes(element) {
  if (element?.attributes == null) { return; }
  var attributes = Array.from(element.attributes);
  var addonAttributes = attributes.filter(a => a.name.startsWith(selectors.addOn.alreadySetRuleAttribute.toLowerCase()));
  for (let attribute of addonAttributes) {
    element.removeAttribute(attribute.name);
  }
  consoleLog(`Reseted addon attributes '${selectors.addOn.alreadySetRuleAttribute}' removed ${addonAttributes.length} attributes for element`);
}

function getAllAlreadySetRuleAttributeNames(configuration = config) {
  return configuration?.fieldUrlRules?.map(r => selectors.addOn.alreadySetRuleAttribute + r.name) ?? [];
}

function resetDataAttributesWithin(rootElement = document) {
  var alreadySetRuleAttributeNames = getAllAlreadySetRuleAttributeNames();
  var anyRuleAttributeSelector = alreadySetRuleAttributeNames.map(a => `[${a}]`).join(",");
  var elementsWithRuleAttributes = rootElement.querySelectorAll(anyRuleAttributeSelector);
  consoleLog(`Resetting addon attributes for ${elementsWithRuleAttributes.length} sub-elements within rootElement`);
  elementsWithRuleAttributes.forEach(e => resetDataAttributes(e));
}

function observeDOM(domElement, callback) {
  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
  if (!domElement || domElement.nodeType !== 1) return; 
  var mutationObserver = new MutationObserver(callback); 
  mutationObserver.observe(domElement, { childList: true, subtree: true }); 
  return mutationObserver; 
}

// #endregion 

function setFieldLink(getUrl, element) {
  var text = element.innerText?.trim();
  var url = getUrl(text);
  var linkHtml = `<a href="${url}" target="blank">${element.innerText}</a>`;
  if (element.innerHTML != linkHtml) {
    element.innerHTML = linkHtml;
  } else {
    consoleLog("LinkHtml already set", element);
  }
}

function AddLinkButton(getUrl, element, text = "", tooltip = "") {
  var innerText = element.innerText?.trim();
  var url = getUrl(innerText);
  // The idea is to make the field text easy to select with double-click, while still having a link button:
  // It is important not to let spaces within <a> or <button> so it doesn't generate an extra space before the field value when double-clicking the text.
  element.innerHTML = 
  `<a href="${htmlEscape(url)}" target='blank'>
      <button type="button"
          style="height: 15px; cursor: pointer;"
          title="${htmlEscape(tooltip)}">
          ${htmlEscape(text)}</button>
      </a><span>${element.innerHTML}</span>`;
}

function getMatchingElements(ruleSelectorList, ruleMatchFunc, ruleName = null) {
  var elements = getElementsToCheck(ruleSelectorList, ruleName);
  if (elements.length <= 0) return [];
  consoleLog("Checking elements: " + elements.length);
  var matchingElements = elements.filter(e => isMatchField(e, ruleMatchFunc, ruleName));
  consoleLog("Matching elements: " + matchingElements.length);
  return matchingElements;
}

function isMatchField(element, matchFunc, ruleName = null) {
  var isMatch = matchFunc(element);
  if (ruleName != null) {
    element.setAttribute(selectors.addOn.alreadySetRuleAttribute + ruleName, isMatch.toString());
  }
  return isMatch;
}

function getElementsToCheck(selectorList, ruleName = null) {
  var elements = [];
  // CloudWatch log results are shown inside an iframe:  <iframe id="microConsole-Logs">
  var documents = getDocumentsIncludingIFrames();
  for (var doc of documents) {
    try {
      var iframeElements = getElementsToCheckInDoc(selectorList, ruleName, doc);
      elements.push(...iframeElements);
    } catch (ex) {
      // Throws error because of this iFrame url:
      // https://global.console.aws.amazon.com/lotus/csp/@amzn/awsconsole-concierge-search-lotus/2/iFrame.html?versionId=6
      consoleLog(`Error trying to get elements from iframe: ${iframe.src} \r ${ex}`);
    }
  }
  return elements;
}

function getElementsToCheckInDoc(selectorList, ruleName = null, doc = document) {
  var elements = [];
  var selector = selectorList.map(s => getSelectorExcludingAlreadyProcessedByRule(s, ruleName)).join(",");
  var elements = Array.from(doc.querySelectorAll(selector));
  //consoleLog(`sub elements selector:  querySelectorAll('${querySelector}') total: ${selectorElements.length}`, doc);
  return elements;
}

function getSelectorExcludingAlreadyProcessedByRule(selector, ruleName = null) {
    var excludeAlreadySetSelector = `:not([${selectors.addOn.alreadySetRuleAttribute + ruleName}])`;
    var querySelector = `${selector}${ruleName == null? '' : excludeAlreadySetSelector}`;
    return querySelector;
}

function querySelectorAllIncludingIframes(querySelector) {
  var documents = getDocumentsIncludingIFrames();
  return documents.flatMap(doc => Array.from(doc.querySelectorAll(querySelector)));
}

function getDocumentsIncludingIFrames(sameDomainOnly = true, includeMainWindowDocument = true) {
  var iframes = Array.from(document.querySelectorAll("iframe"));
  // The browser won't allow access to iframes from other domains.
  var filteredIframes = iframes;
  if (sameDomainOnly) {
    filteredIframes = iframes.filter(i => i.src == null || i.src == '' || new URL(i.src)?.host == document.location.host);
  }
  var documents = filteredIframes.map(i => i.contentWindow.document);
  if (includeMainWindowDocument) {
    documents.push(window.document);
  }
  return documents;
}

// #endregion

(function() {
  'use strict';
  setInterval(runLogLens, config.executionInterval);
})();
