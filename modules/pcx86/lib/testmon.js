/**
 * @fileoverview TestMonitor Class for SerialPort-based Testing
 * @author <a href="mailto:Jeff@pcjs.org">Jeff Parsons</a>
 * @copyright © 2012-2019 Jeff Parsons
 *
 * This file is part of PCjs, a computer emulation software project at <https://www.pcjs.org>.
 *
 * PCjs is free software: you can redistribute it and/or modify it under the terms of the
 * GNU General Public License as published by the Free Software Foundation, either version 3
 * of the License, or (at your option) any later version.
 *
 * PCjs is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with PCjs.  If not,
 * see <http://www.gnu.org/licenses/gpl.html>.
 *
 * You are required to include the above copyright notice in every modified copy of this work
 * and to display that copyright notice when the software starts running; see COPYRIGHT in
 * <https://www.pcjs.org/modules/shared/lib/defines.js>.
 *
 * Some PCjs files also attempt to load external resource files, such as character-image files,
 * ROM files, and disk image files. Those external resource files are not considered part of PCjs
 * for purposes of the GNU General Public License, and the author does not claim any copyright
 * as to their contents.
 */

"use strict";

/*
 * Overview
 * --------
 *
 * TestMonitor monitors activity on the bound SerialPort and a user I/O device (eg, a terminal,
 * a console window, etc).  It operates in several modes:
 *
 * 1) TERMINAL mode: all data received from the SerialPort is routed the user output device,
 * and all data received from the user input device is routed to the SerialPort.  No special actions
 * are taken, until/unless the ATTENTION key is detected from the user input device (ie, Ctrl-T).
 *
 * 2) PROMPT mode: data from the SerialPort is monitored for specific prompts (eg, "A>"), and
 * when one of those prompts is detected, we enter COMMAND mode, with category set to the appropriate
 * collection of tests.
 *
 * 3) COMMAND mode: CR-terminated lines of user input are checked against the current set of test
 * commands, and if a match is found, the corresponding request is sent to the SerialPort.
 */

if (typeof module !== "undefined") {
    var Keys        = require("../../shared/lib/keys");
    var Str         = require("../../shared/lib/strlib");
    var Web         = require("../../shared/lib/weblib");
    var Component   = require("../../shared/lib/component");
    var PCX86       = require("./defines");
}

/**
 * TestMonitor class
 *
 * @class TestMonitor
 * @property {string} mode
 * @property {string} promptActive
 * @property {string} promptBuffer
 * @property {Object|undefined} tests
 * @property {Object|undefined} category (eg, "DOS")
 * @property {string} commandBuffer
 * @property {function(...)} sendData
 * @property {function(...)} sendOutput
 * @property {function(string,...)} printf
 * @unrestricted (allows the class to define properties, both dot and named, outside of the constructor)
 */
class TestMonitor {
    /**
     * TestMonitor()
     *
     * @this {TestMonitor}
     */
    constructor()
    {
        if (DEBUG) console.log("TestMonitor()");
        /*
         * Operations are added to the following queue by addOperation(), which ensures that as soon as it
         * transitions from empty to non-empty, a timeout handler is established to begin draining the queue.
         *
         * While this approach is more complicated than simply sending operations (via sendData()) as they
         * arrive, it has at least one important advantage: special operations, such as "wait" (eg, wait for a
         * key to be pressed), are easier to implement, because control of the draining process can be switched
         * from a timeout handler to an appropriate event handler.
         */
        this.aOperations = [];
        this.idTimeout = 0;
        this.fnRemoveOperation = this.removeOperation.bind(this);
        this.fWaitPending = false;
    }

    /**
     * bindController(controller, sendData, sendOutput, printf, sBinding)
     *
     * @this {TestMonitor}
     * @param {Object} controller
     * @param {function(...)} sendData
     * @param {function(...)} sendOutput
     * @param {function(string,...)} printf
     * @param {string} [sBinding]
     */
    bindController(controller, sendData, sendOutput, printf, sBinding)
    {
        this.sendData = sendData.bind(controller);
        this.sendOutput = sendOutput.bind(controller);
        this.printf = printf.bind(controller);
        controller.bindMonitor(this, this.receiveData, this.receiveInput, this.receiveTests);
        this.printf("%s TestMonitor v%s\n", APPNAME, APPVERSION || XMLVERSION);
        this.printf("Use Ctrl-T to toggle terminal mode%s\n", (sBinding? " (" + sBinding.toUpperCase() + ")" : ""));
        this.setMode(TestMonitor.MODE.TERMINAL);
    }

    /**
     * addCommand(commandLine)
     *
     * @this {TestMonitor}
     * @param {string} commandLine
     * @return {boolean} (true if successful, false if error)
     */
    addCommand(commandLine)
    {
        if (!commandLine) return true;

        let suite = this.tests[this.category];
        let commands = suite['commands'];
        let commandParts = commandLine.split(' ');
        let command = commandParts[0];

        /*
         * Check for a matching command in the current "test suite" category.
         */
        let fExists = false;
        if (commands[command]) {
            fExists = true;
            command = commands[command];
        }

        let op, mode;
        if (typeof command == "string") {
            op = command;
            /*
             * If you don't want any special op processing (eg, for-loop), then use an explicit 'op' property.
             */
            if (this.addForLoop(op)) return true;
        } else {
            op = command['op'];
            mode = command['mode'];
        }

        if (op) {
            let errorMessage = "";
            op = op.replace(/([$%])([0-9]+)/g, function(match, p1, p2, offset, s) {
                let i = +p2;
                let result = "";
                if (i >= commandParts.length) {
                    result = p1 + p2;
                    errorMessage = "missing value for " + result;
                } else if (!i) {
                    result = commandLine;
                } else if (p1 == '$') {
                    result = commandParts[i];
                } else {        // p1 must be '%', which means convert the value to hex
                    result = Str.sprintf("%x", commandParts[i]);
                }
                return result;
            });
            if (errorMessage) {
                this.printf("%s\n", errorMessage);
            } else {
                let i = op.indexOf('(');
                command = (i > 0? op.substr(0, i) : "");
                if (TestMonitor.COMMANDS.indexOf(command) >= 0) {
                    if (!fExists) op = commandLine;
                    fExists = true;
                    let j = op.lastIndexOf(')');
                    if (j > 0) {
                        mode = op.substr(i+1, j-i-1);
                        op = command;
                    }
                }
                else if (TestMonitor.COMMANDS.indexOf(op) >= 0) {
                    fExists = true;
                    mode = commandParts[1];
                }
                if (fExists) {
                    if (DEBUG) console.log("TestMonitor.addCommand(" + commandLine + "): op '" + op + "'");
                    this.addOperation(op, mode);
                    return true;
                }
                this.printf("unrecognized command: %s\n", commandLine);
            }
        } else {
            this.printf("missing operation for command: %s\n", commandParts[0]);
        }
        return false;
    }

    /**
     * addForLoop(commandLine)
     *
     * @this {TestMonitor}
     * @param {string} commandLine
     * @return {boolean}
     */
    addForLoop(commandLine)
    {
        let fSuccess = false;
        let match = commandLine.match(/^\s*for\s+([a-z]+)\s*=\s*([0-9]+)\s+to\s+([0-9]+)\s*{\s*([\s\S]*?)\s*}\s*$/i);
        if (match) {
            fSuccess = true;
            let symbol = match[1];
            let initial = +match[2];
            let final = +match[3];
            let commands = match[4].split(';');
            for (let value = initial; value <= final && fSuccess; value++) {
                for (let i = 0; i < commands.length; i++) {
                    let commandLine = commands[i].trim();
                    if (!commandLine) continue;
                    commandLine = commandLine.replace(new RegExp("\\$" + symbol, 'g'), value.toString());
                    if (!this.addCommand(commandLine)) {
                        fSuccess = false;
                        break;
                    }
                }
            }
        }
        return fSuccess;
    }

    /**
     * addOperation(op, mode)
     *
     * @this {TestMonitor}
     * @param {string} op
     * @param {string} [mode]
     */
    addOperation(op, mode)
    {
        this.aOperations.push(mode? [op, mode] : op);
        this.nextOperation();
    }

    /**
     * flushOperations()
     *
     * @this {TestMonitor}
     */
    flushOperations()
    {
        if (this.idTimeout) {
            clearTimeout(this.idTimeout);
            this.idTimeout = 0;
        }
        this.aOperations = [];
        this.fWaitPending = false;
    }

    /**
     * nextOperation(msDelay)
     *
     * @this {TestMonitor}
     * @param {number} [msDelay]
     * @return {boolean}
     */
    nextOperation(msDelay)
    {
        this.fWaitPending = false;
        if (this.aOperations.length) {
            if (!this.idTimeout) {
                this.idTimeout = setTimeout(this.fnRemoveOperation, msDelay || 0);
            }
            return true;
        }
        this.printf("done\n");
        return false;
    }

    /**
     * removeOperation()
     *
     * @this {TestMonitor}
     */
    removeOperation()
    {
        this.idTimeout = 0;
        let op = this.aOperations.shift();
        if (op) {
            let mode;
            if (typeof op != "string") {
                mode = op[1]; op = op[0];
            }
            if (op == TestMonitor.COMMAND.PRINTF) {
                let format = "nothing to print", args = [];
                if (mode) {
                    let parms = mode.match(/^\s*(["'])([\s\S]*?)\1\s*,?\s*([\s\S]*)$/);
                    if (parms) {
                        format = parms[2];
                        args = parms[3].split(',');
                    }
                }
                this.printf(format, ...args);
            }
            else if (op == TestMonitor.COMMAND.WAIT) {
                if (mode) {
                    this.nextOperation(+mode);
                    return;
                }
                this.printf("press a key to continue...");
                this.fWaitPending = true;
                return;
            }
            else {
                this.sendData(op);
                if (mode) {
                    this.flushOperations();
                    this.setMode(mode);
                    return;
                }
            }
            this.nextOperation();
        }
    }

    /**
     * setMode(mode, category)
     *
     * @this {TestMonitor}
     * @param {string} mode
     * @param {string} [category]
     */
    setMode(mode, category)
    {
        if (mode != this.mode) {
            switch (mode) {
            case TestMonitor.MODE.TERMINAL:
                this.category = null;
                break;

            case TestMonitor.MODE.PROMPT:
                this.aCategories = [];
                this.aPrompts = [];
                this.cchPromptLongest = 0;
                for (let category in this.tests) {
                    let suite = this.tests[category];
                    let prompt = suite[TestMonitor.MODE.PROMPT];
                    if (prompt) {
                        /*
                         * The 'prompt' property is allowed to contain a string or array of strings.
                         */
                        if (typeof prompt == "string") {
                            prompt = [prompt];
                        }
                        for (let i = 0; i < prompt.length; i++) {
                            this.aCategories.push(category);
                            this.aPrompts.push(prompt[i]);
                            if (this.cchPromptLongest < prompt[i].length) {
                                this.cchPromptLongest = prompt[i].length;
                            }
                        }
                    }
                }
                this.promptActive = this.promptBuffer = "";
                this.category = null;
                break;

            case TestMonitor.MODE.COMMAND:
                if (category) this.category = category;
                this.commandBuffer = "";
                break;

            default:
                this.printf("unrecognized mode: %s\n", mode);
                return;
            }

            this.mode = mode;
            this.printf("mode: %s\n", this.category || this.mode);
        }
    }

    /**
     * receiveTests(tests)
     *
     * @this {TestMonitor}
     * @param {Object} tests
     */
    receiveTests(tests)
    {
        if (DEBUG) console.log("TestMonitor.receiveTests(" + JSON.stringify(tests) + ")");
        this.tests = tests;
        this.setMode(TestMonitor.MODE.PROMPT);
    }

    /**
     * receiveData(data)
     *
     * @this {TestMonitor}
     * @param {number} data
     */
    receiveData(data)
    {
        if (this.mode == TestMonitor.MODE.PROMPT) {
            if (this.promptBuffer.length >= this.cchPromptLongest) {
                this.promptBuffer = this.promptBuffer.slice(-(this.cchPromptLongest - 1));
            }
            if (data == 10) this.promptBuffer = "";
            this.promptBuffer += String.fromCharCode(data);
            if (DEBUG) console.log("TestMonitor.receiveData(" + data + "): checking prompts for '" + this.promptBuffer + "'");
            let i = this.aPrompts.indexOf(this.promptBuffer);
            if (i >= 0) {
                this.setMode(TestMonitor.MODE.COMMAND, this.aCategories[i]);
            }
        } else if (this.mode == TestMonitor.MODE.TERMINAL) {
            this.sendOutput(data);
        } else {
            /*
             * TODO: This is where we need to collect the response to any commands we have issued.
             */
            // this.sendOutput(data);
            if (DEBUG) console.log("TestMonitor.receiveData(" + data + "): ignored while mode is '" + this.mode + "'");
        }
    }

    /**
     * receiveInput(charCode)
     *
     * @this {TestMonitor}
     * @param {number} charCode
     */
    receiveInput(charCode)
    {
        if (DEBUG) console.log("TestMonitor.receiveInput(" + charCode + ")");
        if (charCode == Keys.ASCII.CTRL_T) {
            this.setMode(this.mode == TestMonitor.MODE.TERMINAL? (this.category? TestMonitor.MODE.COMMAND : TestMonitor.MODE.PROMPT) : TestMonitor.MODE.TERMINAL);
            return;
        }
        if (this.mode == TestMonitor.MODE.TERMINAL || this.mode == TestMonitor.MODE.PROMPT) {
            this.sendData(charCode);
        } else if (this.mode == TestMonitor.MODE.COMMAND) {
            if (this.fWaitPending) {
                this.sendOutput(Keys.KEYCODE.LF);
                this.nextOperation();
                return;
            }
            if (charCode == Keys.KEYCODE.CR) {
                this.sendOutput(Keys.KEYCODE.LF);
                this.flushOperations();
                this.addCommand(this.commandBuffer.replace(/\\n/g, "\n"));
                this.commandBuffer = "";
            } else {
                if (charCode == Keys.ASCII.CTRL_H || charCode == Keys.ASCII.DEL) {
                    if (this.commandBuffer.length) {
                        this.commandBuffer = this.commandBuffer.slice(0, -1);
                        this.sendOutput("\b \b");
                    }
                } else if (charCode >= 32 && charCode < 127) {
                    this.commandBuffer += String.fromCharCode(charCode);
                    this.sendOutput(charCode);
                }
            }
        }
    }
}

TestMonitor.MODE = {
    TERMINAL:   "terminal",
    PROMPT:     "prompt",
    COMMAND:    "command"
};

TestMonitor.COMMAND = {
    PRINTF:     "printf",
    WAIT:       "wait"
};

TestMonitor.COMMANDS = [
    TestMonitor.COMMAND.PRINTF,
    TestMonitor.COMMAND.WAIT
];

if (typeof module !== "undefined") module.exports = TestMonitor;
