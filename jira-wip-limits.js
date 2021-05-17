// ==UserScript==
// @name     Handle WIP Limits
// @version  1
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @require     https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant       GM_addStyle
// ==/UserScript==

function addGlobalStyle(css) {
  var head, style;
  head = document.getElementsByTagName('head')[0];
  if (!head) { return; }
  style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = css;
  head.appendChild(style);
}

// Make the swimlane header gold when the WIP
// matches the limit.
// Make the swimlane header red when the WIP 
// exceeds the limit.
addGlobalStyle('.ghx-swimlane-header.wip-over-limit { background-color: red ! important; }');
addGlobalStyle('.ghx-swimlane-header.wip-at-limit { background-color: gold ! important; }');

var state = {
  columns: [
    {
      name: "READY FOR CODE REVIEW",
      quantity: -1,
      wipLimit: -1,
      nodeRef: null
    },
    {
      name: "IN CODE REVIEW",
      quantity: -1,
      wipLimit: -1,
      nodeRef: null
    }
  ],
  swimlane: {
    includedColumns: {
      "IN REFINEMENT": {},
      "IN PROGRESS": {},
      "READY FOR CODE REVIEW": {},
      "IN CODE REVIEW": {},
      "AWAITING DEPLOY": {}
    },
    includedColumnsById: {
    },
    data: {

    }
  },
  columnsHandled: 0,
  totalWIPLimit: 0
};

function getColumnName(node) {
  return node.children()[0].children[0].firstChild.textContent.toUpperCase();
}

function getColumnDataId(node) {
  return node[0].attributes["data-id"].value;
}

function getIssueColumnDataId(node) {
  return node.parent().parent().parent().parent()[0].attributes["data-column-id"].value;
}

function findColumnsForSwimlaneWIPLimits(node, columnName) {
  column = state.swimlane.includedColumns[columnName];
  if (column !== undefined) {
    id = getColumnDataId(node);
    state.swimlane.includedColumnsById[id] = true;
  }
}

function getSwimlaneTitleAndWIPLimit(node) {
  swimlaneTitle = node.children()[1].innerText;
  parts = swimlaneTitle.split(" ");
  wipLimit = parseInt(parts[parts.length-1]);
  return [swimlaneTitle, wipLimit];
}

function getIssueSwimlaneTitle(node) {
  swimlaneTitle = node.parent().parent().parent().parent().parent().parent().children()[0].children[0].children[1].innerText;
  return swimlaneTitle;
}

function initializeIssueCount(swimlaneTitle) {
  if (!('issueCount' in state.swimlane.data[swimlaneTitle])) {
    state.swimlane.data[swimlaneTitle]['issueCount'] = 0;
  }
}

function incrementCountTowardsWipLimit(swimlaneTitle, node) {
  initializeIssueCount(swimlaneTitle);
  id = getIssueColumnDataId(node);
  if (id in state.swimlane.includedColumnsById) {
    state.swimlane.data[swimlaneTitle]['issueCount']++;
  }
}

function getSwimlaneHeading(node) {
  return node.parent().parent().parent().parent().parent().parent().children()[0];
}

function markSwimlaneHeadingOverlimit(node) {
  markSwimlaneHeadingNormal(node);
  getSwimlaneHeading(node).className += " wip-over-limit";
}

function markSwimlaneHeadingAtlimit(node) {
  markSwimlaneHeadingNormal(node);
  getSwimlaneHeading(node).className += " wip-at-limit";
}

function markSwimlaneHeadingNormal(node) {
  getSwimlaneHeading(node).className = getSwimlaneHeading(node).className.replace(" wip-at-limit", "").replace(" wip-over-limit", "");
}

function checkSwimlaneWipLimit(swimlaneTitle, node) {
  swimlaneData = state.swimlane.data[swimlaneTitle];
  if ('wipLimit' in swimlaneData) {
    initializeIssueCount(swimlaneTitle);
    if (swimlaneData['issueCount'] > swimlaneData['wipLimit']) {
      markSwimlaneHeadingOverlimit(node);
    }
    else if (swimlaneData['issueCount'] == swimlaneData['wipLimit']) {
      markSwimlaneHeadingAtlimit(node);
    }
    else {
      markSwimlaneHeadingNormal(node);
    }
  }
}

function updateMultiColumnWIPLimits(node, columnName) {
  state.columns.forEach((column) => {
    if (columnName == column.name) {
      column.nodeRef = node;
      // Get the higher WIP limit.
      // This is stored as Max X, where X is the limit.
      // Replace the "Max " with empty string to get "X".
      // Then parseInt("X") to get an integer X.
      maxText = node.children()[0].children[1].children[0].textContent;
      limitText = maxText.replace("Max ", "");
      column.wipLimit = parseInt(limitText);
      state.totalWIPLimit += column.wipLimit;
      // Find the number of tickets in this column, which is stored in
      // the node with class "ghx-qty".
      column.quantity = parseInt(node.children()[0].children[0].children[1].textContent);
      // Increment the number of columns handled.
      state.columnsHandled++;
      // If that matches the total number of columns,
      // adjust the wip limits based on the number of tickets.
      if (state.columnsHandled === state.columns.length) {
        columnCount = state.columns.length;
        wipLeft = state.totalWIPLimit;
        // If the total number of tickets is less than the WIP limit,
        // then set the WIP limits for all columns except the first one (the left most) to
        // the number of tickets that are in the column.
        // Set the leftmost column to the remainder to reach the total WIP limit.
        // If there is any WIP left, then it allows the leftmost column to get the benefit of
        // the entire number.
        state.columns.reverse().forEach((column) => {
          var wipLimit;
          columnCount--;
          // Not the last column?
          // Set the WIP Limit to the lower of the number of tickets in the column
          // and the remaining WIP Limit. If the remaining WIP limit is less than zero
          // then set the limit to 0.
          if (columnCount > 0) {
            if (column.quantity <= wipLeft) {
              wipLimit = column.quantity;
            } else {
              wipLimit = wipLeft;
            }
            wipLeft -= wipLimit;
            column.nodeRef.children()[0].children[1].children[0].textContent = "Max " + wipLimit.toString();
          } else {
            wipLimit = wipLeft;
            column.nodeRef.children()[0].children[1].children[0].textContent = "Max " + wipLeft.toString();
          }
          if (column.quantity <= wipLimit) {
            column.nodeRef[0].classList = "ghx-column";
          } else {
            column.nodeRef[0].classList = "ghx-column ghx-busted ghx-busted-max";
          }
        });                
      }
    }
  });
}

waitForKeyElements(".ghx-column", function(node) {
    columnName = getColumnName(node);
    updateMultiColumnWIPLimits(node, columnName);
    findColumnsForSwimlaneWIPLimits(node, columnName);
});

waitForKeyElements(".ghx-heading", function(node) {
  swimlaneTitleAndWIPLimit = getSwimlaneTitleAndWIPLimit(node);
  swimlaneTitle = swimlaneTitleAndWIPLimit[0];
  wipLimit = swimlaneTitleAndWIPLimit[1];
  state.swimlane.data[swimlaneTitle] = {
    node: node,
    wipLimit: wipLimit
  };
  initializeIssueCount(swimlaneTitle);
  checkSwimlaneWipLimit(swimlaneTitle, node);
});


waitForKeyElements(".ghx-key", function(node) {
  swimlaneTitle = getIssueSwimlaneTitle(node);
  incrementCountTowardsWipLimit(swimlaneTitle, node);
  checkSwimlaneWipLimit(swimlaneTitle, node);
});
