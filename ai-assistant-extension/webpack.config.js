//@ts-check
'use strict';

const path = require('path');
const webpack = require('webpack');

/** @typedef {import('webpack').Configuration} WebpackConfig */

/** @type WebpackConfig */
const extensionConfig = {
    target: 'node',
    mode: 'none',
    entry: {
        extension: './src/extension.ts'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    externals: {
        vscode: 'commonjs vscode',
        'node-machine-id': 'commonjs node-machine-id',
        fsevents: "fsevents"
    },
    resolve: { extensions: ['.ts', '.js'] },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            // Skip type checking to speed up compilation
                            transpileOnly: true
                        }
                    }
                ]
            },
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    devtool: 'nosources-source-map',
    infrastructureLogging: { level: "log" },
    optimization: { minimize: true },
    performance: { hints: false },
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
        })
    ]
};

module.exports = extensionConfig;
