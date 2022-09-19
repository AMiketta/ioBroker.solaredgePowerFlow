"use strict";

/*
 * Solaredge Monitoring
 * github.com/92lleo/ioBroker.solaredge
 *
 * (c) 2019 Leonhard Kuenzler (MIT)
 *
 * Created with @iobroker/create-adapter v1.18.0
 */

const utils = require("@iobroker/adapter-core");
const request = require('request');

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;
let timer;
let createStates;
let siteid;

/**
 * Starts the adapter instance
 * @param {Partial<ioBroker.AdapterOptions>} [options]
 */
function startAdapter(options) {
    // Create the adapter and define its methods
    return adapter = utils.adapter(Object.assign({}, options, {
        name: "solaredgepowerflow",

        // The ready callback is called when databases are connected and adapter received configuration.
        // start here!
        ready: main, // Main method defined below for readability

        // is called when adapter shuts down - callback has to be called under any circumstances!
        unload: (callback) => {
            try {
                adapter.log.info("cleaned everything up...");
                clearTimeout(timer);
                callback();
            } catch (e) {
                callback();
            }
        },
    }));
}

function checkStateCreationNeeded(stateName){
    adapter.instance
    adapter.getState('solaredgepowerflow.' + adapter.instance + '.' + siteid + '.' + stateName, function (err, state) {
        if (!state) {
            adapter.log.info("state "+stateName+" does not exist, will be created");
            createStates = true;
        } else {
            adapter.log.debug("state "+stateName+" exists");
            createStates |= false;
        }
    });
}

function checkStatesCreationNeeded(){
    checkStateCreationNeeded('currentGRID');
    checkStateCreationNeeded('currentLOAD');
    checkStateCreationNeeded('currentPV');
}

function main() {

    siteid = adapter.config.siteid;
    var apikey = adapter.config.apikey;

    adapter.log.info("site id: " + siteid);
    adapter.log.info("api key: " + (apikey ? (apikey.substring(0, 4) + "...") : "not set"));

    // adapter only works with siteid and api key set
    if ((!siteid) || (!apikey)) {
        adapter.log.error("siteid or api key not set")
    } else {
        var resource = "currentPowerFlow";

        // for some other resources the url itself might change
        var url = "https://monitoringapi.solaredge.com/site/" + siteid + "/" + resource + ".json?api_key=" + apikey;

        checkStatesCreationNeeded();

        request({
                url: url,
                json: true
            },
            function (error, response, content) {
                if (!error && response.statusCode == 200) {
                    if (content) {

                        var callback = function (val) {}

                        var siteCurrentPowerFlow = content.siteCurrentPowerFlow;
                        var direction = siteCurrentPowerFlow.connections.from;
                        
                        var currentGrid = siteCurrentPowerFlow.GRID.currentPower:
                        if (direction == "GRID") {
                          currentGrid = currentGrid * -1;      
                        }

                        adapter.log.info("Current PV power for " + siteid + ": " + siteCurrentPowerFlow.PV.currentPower + " KW");

                        if (createStates) {
                            adapter.log.debug("creating states");
                            // create all states, only needed on first start or after state deletion

                            adapter.createState('', siteid, 'currentGRID', {
                                name: "currentGRID",
                                def: currentGrid,
                                type: 'number',
                                read: true,
                                write: false,
                                role: 'value',
                                desc: 'current power from grid in KW'
                            }, callback);

                            adapter.createState('', siteid, 'currentLOAD', {
                                name: "currentLOAD",
                                def: siteCurrentPowerFlow.LOAD.currentPower,
                                type: 'number',
                                read: true,
                                write: false,
                                role: 'value',
                                desc: 'current load in KW'
                            }, callback);

                            adapter.createState('', siteid, 'currentPV', {
                                name: "currentPV",
                                def: siteCurrentPowerFlow.PV.currentPower,
                                type: 'number',
                                read: true,
                                write: false,
                                role: 'value',
                                desc: 'current PV power in KW'
                            }, callback);

                            createStates = false;

                        } else {
                            // just update
                            adapter.log.debug("updating states");

                          
                            adapter.setStateChanged(siteid + '.currentGRID', currentGrid, true);
                            adapter.setStateChanged(siteid + '.currentLOAD', siteCurrentPowerFlow.LOAD.currentPower, true);
                            adapter.setStateChanged(siteid + '.currentPV', siteCurrentPowerFlow.PV.currentPower, true);
                        }
                    } else {
                        adapter.log.warn('Response has no valid content. Check your data and try again. ' + response.statusCode);
                    }
                } else {
                    adapter.log.warn(error);
                }

                adapter.log.info("Done, stopping...");
                adapter.stop();
            });
    }

    // (force) stop adapter after 15s
    timer = setTimeout(function() {
        adapter.log.warn("Timeout, stopping...");
        adapter.stop();
    }, 15000);
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}
