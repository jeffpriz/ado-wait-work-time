/**
 * Common initialization for Azure DevOps extension
 * This module provides the root component rendering functionality
 */

import "azure-devops-ui/Core/override.css";
import "es6-promise/auto";
import "./Common.scss";
import * as React from "react";
import * as ReactDOM from "react-dom";

/**
 * Renders the root React component into the DOM
 * @param component - The React element to render as the root component
 */
export const showRootComponent = (component: React.ReactElement<any>): void => {
  ReactDOM.render(component, document.getElementById("root"));
};