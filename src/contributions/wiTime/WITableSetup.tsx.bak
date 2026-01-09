
import * as React from "react";
import { ObservableValue } from "azure-devops-ui/Core/Observable";
import {
    ITableColumn,
    renderSimpleCell,
    SimpleTableCell
} from "azure-devops-ui/Table";
import { Link } from "azure-devops-ui/Link";
import * as workItemInterfaces from "./WorkItemInfo";

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

export function RenderIDLink(
    rowIndex: number,
    columnIndex: number,
    tableColumn: ITableColumn<workItemInterfaces.IWorkItemTableDisplay>,
    tableItem: workItemInterfaces.IWorkItemTableDisplay
): JSX.Element
{
    const { workItemID,  workItemLink} = tableItem;
    return (

        <SimpleTableCell columnIndex={columnIndex} tableColumn={tableColumn} key={"col-" + columnIndex} contentClassName="fontWeightSemiBold font-weight-semibold fontSizeM font-size-m scroll-hidden">
            <Link subtle={false} excludeTabStop href={workItemLink} target="_blank">
                {workItemID}
            </Link>
        </SimpleTableCell>
    );
}


export const WIListColumns = [
    {
        id: "workItemID",
        name: "Work Item ID",
        readonly: true,
        renderCell: renderSimpleCell,
        width: new ObservableValue(-30),
    }
]

