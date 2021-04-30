import { renderSimpleCell } from "azure-devops-ui/Table";

import { ObservableValue } from "azure-devops-ui/Core/Observable";

export const workItemColumns = [
{
    id: "workItemID",
    name: "ID",
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-8),
},
{
    id: "revNum",
    name: "Rev.",
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-8),
},
{
    id: "workItemTitle",
    name: "Title",
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-35),
},
{
    id:"boardColumn",
    name: "Board Column",
    readonly:true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-15)
},
{
    id:"boardColumnStartTime",
    name: "Change Date",
    readonly:true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-20)
},
{
    id:"timeInColumn",
    name: "Time in this Column",
    readonly:true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-35)
}


];

export const WIListColumns = [
    {
        id: "workItemID",
        name: "Work Item ID",
        readonly: true,
        renderCell: renderSimpleCell,
        width: new ObservableValue(-30),
    }
]

