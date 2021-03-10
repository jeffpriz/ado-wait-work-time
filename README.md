# ado-wait-work-time

[![Build Status](https://dev.azure.com/oneluckidev/OneLuckiDev/_apis/build/status/jeffpriz.ado-wait-work-time?branchName=main)](https://dev.azure.com/oneluckidev/OneLuckiDev/_build/latest?definitionId=36&branchName=main)
![CI Score](https://www.code-inspector.com/project/20024/score/svg)
![CI Grade](https://www.code-inspector.com/project/20024/status/svg)

Azure DevOps extension to put a Work Item hub on the site to report the average time that a backlog work item spends in board columns.  

This works by Team, and backlog level, and for a given timeframe.  

This Works through many types of Customizations that people make in Azure Devops, so it looks at the Teams Backlog levels, what Work Items that are assigned to each backlog level (User Stories, Bugs, Features, Epics etc...) including custom work item types.  It also accounts for custom process templates where the "Completed" column is set, so teams that have changed the "Closed" state to "Done" for example are still handled.  Also since we are looking at the Team's backlog configuration we know if it has Epic level, Feature level backlogs.. also, we know if there are other custom levels to the backlog, and we are able to grab that use those work item types.
