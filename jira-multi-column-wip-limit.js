// ==UserScript==
// @name     Handle WIP Limits
// @version  1
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @require     https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant       GM_addStyle
// ==/UserScript==


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
  swimlaneTitle = node.parent().parent().parent().children()[0].children[0].children[1].innerText;
  return swimlaneTitle;
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
  state.swimlane.data[swimlaneTitle] = {wipLimit: wipLimit, issueCount: 0};
});


waitForKeyElements(".ghx-issue", function(node) {
  swimlaneTitle = getIssueSwimlaneTitle(node);
});
