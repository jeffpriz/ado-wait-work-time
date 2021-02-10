import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import * as API from "azure-devops-extension-api";
import { showRootComponent } from "../../Common";
import { GitRepository, IdentityRefWithVote } from "azure-devops-extension-api/Git/Git";

interface IRepositoryServiceHubContentState {
    repository: GitRepository | null;
    exception: string;
    isToastVisible: boolean;
    isToastFadingOut: boolean;
    foundCompletedPRs: boolean;
    doneLoading:boolean;
}
class RepositoryServiceHubContent extends React.Component<{}, IRepositoryServiceHubContentState> {
}