
# UserScript: Aws-CloudWatch-LogLens


## Description

Convert AWS log fields into links that provides further info.  
`TimeLens` makes CloudWatch timestamps into links to filter the logs around the same time.  
`IpLens` opens a link to the IP geolocation and info.


## How to install

Install the script [Aws-CloudWatch-LogLens.js](./src/Aws-CloudWatch-LogLens.js) 
following the general installation steps [here](../../README.md#How-to-install-UserScripts).  


## HOW IT WORKS
This script scans the DOM and its iframes every 5 seconds searching for the configured element selectors,
then it runs the configured rules and adds links to related info when the rule matches.
To prevent impacting the page performance for efficiency,
it adds data-attributes as cache to identify fields that have been already processed.
But XRay results table changes the content of the fields dynamically during column reordering and it doesn't remove the cached attributes,
so it also has to observe those DOM changes to clear the cache stored as data attributes in the DOM elements.
If anything goes wrong, the user can still double-click or right-click a cell
to clear the cache attribute and force it to be processed again in the next few seconds.

## HOW TO TEST
XRay + Column-Reordering: filter by "Client IP"
CloudWatch: with "fields @timestamp"
CloudWatch: with Step-Functions
CloudWatch: with a column that contains single IPs.

