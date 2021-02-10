const path = require("path");
const fs = require("fs");
const CopyWebpackPlugin = require("copy-webpack-plugin");

// Webpack entry points. Mapping from resulting bundle name to the source file entry.
const entries = {};

// Loop through subfolders in the "Samples" folder and add an entry for each one
const panelsDir = path.join(__dirname, "src/contributions");
fs.readdirSync(panelsDir).filter(dir => {
    if (fs.statSync(path.join(panelsDir, dir)).isDirectory()) {
        entries[dir] = "./" + path.relative(process.cwd(), path.join(panelsDir, dir, dir));
    }
});

module.exports = {
    entry: entries,
    output: {
        filename: "[name]/[name].js"
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"],        
        alias: {
            "azure-devops-extension-sdk": path.resolve("node_modules/azure-devops-extension-sdk")
        },
    },
    stats: {
        warnings: false
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader"
            },
            {
                test: /\.scss$/,
                use: ["style-loader", "css-loader", "azure-devops-ui/buildScripts/css-variables-loader", "sass-loader"]
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"],
            },
            {
                test: /\.woff$/,
                use: [{
                    loader: 'base64-inline-loader'
                }]
            },
            {
                test: /\.html$/,
                exclude: [/\canvg?$/],
                exclude: [/\xlsx?$/],
                loader: "file-loader"
            }
        ]
    },
    plugins: [
        new CopyWebpackPlugin([ { from: "**/*.html", context: "src/contributions" }]),
        new CopyWebpackPlugin([ { from: "**/*.png", context: "src/contributions" }])
    ]
};
