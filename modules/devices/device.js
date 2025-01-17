/**
 * @fileoverview Base class for devices, with assorted handy services
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
 * <https://www.pcjs.org/modules/devices/machine.js>.
 *
 * Some PCjs files also attempt to load external resource files, such as character-image files,
 * ROM files, and disk image files. Those external resource files are not considered part of PCjs
 * for purposes of the GNU General Public License, and the author does not claim any copyright
 * as to their contents.
 */

"use strict";

/**
 * @define {boolean}
 */
var COMPILED = false;

/**
 * @define {boolean}
 */
var DEBUG = true;

/**
 * @define {string}
 */
var FACTORY = "Machine";

/**
 * @define {string}
 */
var VERSION = "2.00";

/*
 * List of standard message groups.
 *
 * NOTE: To support more than 32 message groups, be sure to use "+", not "|", when concatenating.
 */
var MESSAGES = {
    NONE:       0x000000000000,
    DEFAULT:    0x000000000000,
    ADDRESS:    0x000000000001,
    CPU:        0x000000000002,
    TIMER:      0x000000080000,
    EVENT:      0x000200000000,
    KEY:        0x000400000000,
    WARN:       0x100000000000,
    HALT:       0x200000000000,
    BUFFER:     0x400000000000,
    ALL:        0xffffffffffff
};

var Messages = MESSAGES.NONE;

/**
 * The following properties are the standard set of properties a Device's config object may contain.
 * Other devices will generally define their own extended versions (eg, LEDConfig, InputConfig, etc).
 *
 * @typedef {Object} Config
 * @property {string} [class]
 * @property {Object} [bindings]
 * @property {number} [version]
 * @property {string} [status]
 * @property {Array.<string>} [overrides]
 */

/**
 * @class {Device}
 * @unrestricted
 * @property {string} idMachine
 * @property {string} idDevice
 * @property {Config} config
 * @property {Object} bindings [added by addBindings()]
 * @property {number} messages
 * @property {string} sCommandPrev
 */
class Device extends StdIO {
    /**
     * Device()
     *
     * Supported config properties:
     *
     *      "bindings": object containing name/value pairs, where name is the generic name
     *      of a element, and value is the ID of the DOM element that should be mapped to it
     *
     * The properties in the "bindings" object are copied to our own bindings object in addBindings(),
     * but only for DOM elements that actually exist, and it is the elements themselves (rather than
     * their IDs) that we store.
     *
     * Also, URL parameters can be used to override config properties.  For example, the URL:
     *
     *      http://pcjs:8088/devices/ti57/machine/?cyclesPerSecond=100000
     *
     * will set the Time device's cyclesPerSecond config property to 100000.  In general, the values
     * will be treated as strings, unless they contain all digits (number), or equal "true" or "false"
     * (boolean).
     *
     * @this {Device}
     * @param {string} idMachine
     * @param {string} idDevice
     * @param {Config} [config]
     * @param {number} [version]
     */
    constructor(idMachine, idDevice, config, version)
    {
        super();
        this.config = config || {};
        this.idMachine = idMachine;
        this.idDevice = idDevice;
        this.version = version || 0;
        this.status = "OK";
        this.messages = 0;
        this.bindings = {};
        this.addDevice();
        this.checkVersion(this.config);
        this.checkOverrides(this.config);
        this.addBindings(this.config['bindings']);
        this.sCommandPrev = "";
    }

    /**
     * addBinding(binding, element)
     *
     * @this {Device}
     * @param {string} binding
     * @param {Element} element
     */
    addBinding(binding, element)
    {
        let device = this, elementTextArea;

        switch (binding) {

        case Device.BINDING.CLEAR:
            element.onclick = function onClickClear() {
                device.clear();
            };
            break;

        case Device.BINDING.PRINT:
            elementTextArea = /** @type {HTMLTextAreaElement} */ (element);
            /*
             * This was added for Firefox (Safari will clear the <textarea> on a page reload, but Firefox does not).
             */
            elementTextArea.value = "";
            /*
             * An onKeyPress handler has been added to this element simply to stop event propagation, so that if the
             * element has been explicitly given focus, any key presses won't be picked up by the Input device (which,
             * as that device's constructor explains, is monitoring key presses for the entire document).
             */
            elementTextArea.addEventListener(
                'keypress',
                function onKeyPress(event) {
                    event = event || window.event;
                    let keyCode = event.which || event.keyCode;
                    if (keyCode) {
                        /*
                         * Move the caret to the end of any text in the textarea.
                         */
                        let sText = elementTextArea.value;
                        elementTextArea.setSelectionRange(sText.length, sText.length);

                        /*
                         * Don't let the Input device's document-based keypress handler see any key presses
                         * that came to this element first.
                         */
                        event.stopPropagation();

                        /*
                         * On the ENTER key, look for any COMMAND handlers and invoke them until one of them
                         * returns true.
                         */
                        if (keyCode == 13) {
                            /*
                             * At the time we call any command handlers, a linefeed will not yet have been
                             * appended to the text, so for consistency, we prevent the default behavior and
                             * add the linefeed ourselves.  Unfortunately, one side-effect is that we must
                             * go to some extra effort to ensure the cursor remains in view; hence the stupid
                             * blur() and focus() calls.
                             */
                            event.preventDefault();
                            sText = (elementTextArea.value += '\n');
                            elementTextArea.blur();
                            elementTextArea.focus();
                            device.doCommand(sText);
                        }
                    }
                }
            );
            break;
        }
    }

    /**
     * addBindings(bindings)
     *
     * Builds the set of ACTUAL bindings (this.bindings) from the set of DESIRED bindings (this.config['bindings']),
     * using either a "bindings" object map OR an array of "direct bindings".
     *
     * @this {Device}
     * @param {Object} bindings
     */
    addBindings(bindings)
    {
        let fDirectBindings = Array.isArray(bindings);
        for (let binding in bindings) {
            let id = bindings[binding];
            if (fDirectBindings) binding = id;
            let element = document.getElementById(id);
            if (element) {
                this.bindings[binding] = element;
                this.addBinding(binding, element);
                continue;
            }
            if (DEBUG && !fDirectBindings) this.println("unable to find device ID: " + id);
        }
    }

    /**
     * addBindingOptions(element, options, fReset, sDefault)
     *
     * @this {Device}
     * @param {Element|HTMLSelectElement} element
     * @param {Object} options (eg, key/value pairs for a series of "option" elements)
     * @param {boolean} [fReset]
     * @param {string} [sDefault]
     */
    addBindingOptions(element, options, fReset, sDefault)
    {
        if (fReset) {
            element.options.length = 0;
        }
        if (options) {
            for (let prop in options) {
                let option = document.createElement("option");
                option.text = prop;
                option.value = (typeof options[prop] == "string"? options[prop] : prop);
                element.appendChild(option);
                if (option.value == sDefault) element.selectedIndex = element.options.length - 1;
            }
        }
    }

    /**
     * addDevice()
     *
     * Adds this Device to the global set of Devices, so that findDevice(), findBinding(), etc, will work.
     *
     * @this {Device}
     */
    addDevice()
    {
        if (!Device.Machines[this.idMachine]) Device.Machines[this.idMachine] = [];
        Device.Machines[this.idMachine].push(this);
    }

    /**
     * addHandler(sType, fn)
     *
     * @this {Device}
     * @param {string} sType
     * @param {function(Array.<string>,Device)} fn
     */
    addHandler(sType, fn)
    {
        if (!Device.Handlers[this.idMachine]) Device.Handlers[this.idMachine] = {};
        if (!Device.Handlers[this.idMachine][sType]) Device.Handlers[this.idMachine][sType] = [];
        Device.Handlers[this.idMachine][sType].push(fn);
    }

    /**
     * alert(s, type)
     *
     * @this {Device}
     * @param {string} s
     * @param {string} [type]
     */
    alert(s, type)
    {
        if (type && Device.Alerts.list.indexOf(type) < 0) {
            alert(s);
            Device.Alerts.list.push(type);
        }
        this.println(s);
    }

    /**
     * assert(f, s)
     *
     * Verifies conditions that must be true (for DEBUG builds only).
     *
     * The Closure Compiler should automatically remove all references to assert() in non-DEBUG builds.
     * TODO: Add a task to the build process that "asserts" there are no instances of "assertion failure" in RELEASE builds.
     *
     * @this {Device}
     * @param {*} f is the expression asserted to be true
     * @param {string} [s] is description of the assertion on failure
     */
    assert(f, s)
    {
        if (DEBUG) {
            if (!f) {
                throw new Error(s || "assertion failure");
            }
        }
    }

    /**
     * checkOverrides(config)
     *
     * @this {Device}
     * @param {Config} config
     */
    checkOverrides(config)
    {
        /*
         * If this device's config contains an "overrides" array, then any of the properties listed in
         * that array may be overridden with a URL parameter.  We don't impose any checks on the overriding
         * value, so it is the responsibility of the component with overridable properties to validate them.
         */
        if (config['overrides']) {
            let parms = this.getURLParms();
            for (let prop in parms) {
                if (config['overrides'].indexOf(prop) >= 0) {
                    let value;
                    let s = parms[prop];
                    /*
                     * You might think we could simply call parseInt() and check isNaN(), but parseInt() has
                     * some annoying quirks, like stopping at the first non-numeric character.  If the ENTIRE
                     * string isn't a number, then we don't want to treat ANY part of it as a number.
                     */
                    if (s.match(/^[+-]?[0-9.]+$/)) {
                        value = Number.parseInt(s, 10);
                    } else if (s == "true") {
                        value = true;
                    } else if (s == "false") {
                        value = false;
                    } else {
                        value = s;
                        s = '"' + s + '"';
                    }
                    config[prop] = value;
                    this.println("overriding " + this.idDevice + " property '" + prop + "' with " + s);
                }
            }
        }
    }

    /**
     * checkVersion(config)
     *
     * Verify that device's version matches the machine's version, and also that the config version stored in
     * the JSON (if any) matches the device's version.
     *
     * This is normally performed by the constructor, but the Machine device cannot be fully initialized in the
     * constructor, so it calls this separately.
     *
     * @this {Device}
     * @param {Config} config
     */
    checkVersion(config)
    {
        if (this.version) {
            let sVersion = "", version;
            let machine = this.findDevice(this.idMachine);
            if (machine.version != this.version) {
                sVersion = "Machine";
                version = machine.version;
            }
            else if (config.version && config.version > this.version) {
                sVersion = "Config";
                version = config.version;
            }
            if (sVersion) {
                let sError = this.sprintf("%s Device version (%3.2f) incompatible with %s version (%3.2f)", config.class, this.version, sVersion, version);
                this.alert("Error: " + sError + '\n\n' + "Clearing your browser's cache may resolve the issue.", Device.Alerts.Version);
            }
        }
    }

    /**
     * clear()
     *
     * @this {Device}
     */
    clear()
    {
        let element = this.findBinding(Device.BINDING.PRINT, true);
        if (element) element.value = "";
    }

    /**
     * doCommand(sText)
     *
     * NOTE: To ensure that this function's messages are displayed, use super.println with fBuffer set to false.
     *
     * @this {Device}
     * @param {string} sText
     */
    doCommand(sText)
    {
        let afnHandlers = this.findHandlers(Device.HANDLER.COMMAND);
        if (afnHandlers) {

            let i = sText.lastIndexOf('\n', sText.length - 2);
            let sCommand = sText.slice(i + 1, -1) || this.sCommandPrev, sResult;
            this.sCommandPrev = "";
            sCommand = sCommand.trim();
            let aTokens = sCommand.split(' ');
            let token, message, on;

            switch(aTokens[0]) {
            case 'm':
                token = aTokens[aTokens.length-1].toLowerCase();
                on = (token == "true" || token == "on"? true : (token == "false" || token == "off"? false : undefined));
                if (on != undefined) {
                    aTokens.pop();
                } else {
                    if (aTokens.length <= 1) {
                        aTokens = Object.keys(MESSAGES);
                        aTokens.shift(); aTokens.shift(); aTokens.pop();
                    }
                }
                for (i = 1; i < aTokens.length; i++) {
                    token = aTokens[i].toUpperCase();
                    message = MESSAGES[token];
                    if (!message) {
                        super.println("unrecognized message group: " + token, false);
                        break;
                    }
                    if (on != undefined) {
                        this.setMessages(message, on);
                    }
                    super.println(token + ": " + this.isMessageOn(message), false);
                }
                break;

            case '?':
                sResult = "";
                Device.COMMANDS.forEach((cmd) => {sResult += '\n' + cmd;});
                if (sResult) super.println("default commands:" + sResult, false);
                /* falls through */

            default:
                aTokens.unshift(sCommand);
                for (i = 0; i < afnHandlers.length; i++) {
                    if (afnHandlers[i](aTokens, this)) break;
                }
                break;
            }
        }
    }

    /**
     * findBinding(name, fAll)
     *
     * This will search the current device's bindings, and optionally all the device bindings within the
     * machine.  If the binding is found in another device, that binding is recorded in this device as well.
     *
     * @this {Device}
     * @param {string} name
     * @param {boolean} [fAll]
     * @returns {Element|null|undefined}
     */
    findBinding(name, fAll = false)
    {
        let element = this.bindings[name];
        if (element === undefined && fAll) {
            let devices = Device.Machines[this.idMachine];
            for (let i in devices) {
                element = devices[i].bindings[name];
                if (element) break;
            }
            if (!element) element = null;
            this.bindings[name] = element;
        }
        return element;
    }

    /**
     * findDevice(idDevice)
     *
     * @this {Device}
     * @param {string} idDevice
     * @returns {Device|undefined}
     */
    findDevice(idDevice)
    {
        let device;
        let devices = Device.Machines[this.idMachine];
        if (devices) {
            for (let i in devices) {
                if (devices[i].idDevice == idDevice) {
                    device = devices[i];
                    break;
                }
            }
        }
        return device;
    }

    /**
     * findDeviceByClass(idClass)
     *
     * @this {Device}
     * @param {string} idClass
     * @returns {Device|undefined}
     */
    findDeviceByClass(idClass)
    {
        let device;
        let devices = Device.Machines[this.idMachine];
        if (devices) {
            for (let i in devices) {
                if (devices[i].config['class'] == idClass) {
                    device = devices[i];
                    break;
                }
            }
        }
        return device;
    }

    /**
     * findHandlers(sType)
     *
     * @this {Device}
     * @param {string} sType
     * @returns {Array.<function(Array.<string>,Device)>|undefined}
     */
    findHandlers(sType)
    {
        return Device.Handlers[this.idMachine] && Device.Handlers[this.idMachine][sType];
    }

    /**
     * getBindingID(name)
     *
     * Since this.bindings contains the actual elements, not their original IDs, we must delve back into
     * the original this.config['bindings'] to determine the original ID.
     *
     * @this {Device}
     * @param {string} name
     * @returns {string|undefined}
     */
    getBindingID(name)
    {
        return this.config['bindings'] && this.config['bindings'][name];
    }

    /**
     * getBindingText(name)
     *
     * @this {Device}
     * @param {string} name
     * @return {string|undefined}
     */
    getBindingText(name)
    {
        let sText;
        let element = this.bindings[name];
        if (element) sText = element.textContent;
        return sText;
    }

    /**
     * getBounded(n, min, max)
     *
     * Restricts n to the bounds defined by min and max.  A side-effect is ensuring that the return
     * value is ALWAYS a number, even if n is not.
     *
     * @this {Device}
     * @param {number} n
     * @param {number} min
     * @param {number} max
     * @returns {number} (updated n)
     */
    getBounded(n, min, max)
    {
        this.assert(min <= max);
        n = +n || 0;
        if (n < min) n = min;
        if (n > max) n = max;
        return n;
    }

    /**
     * getDefault(idConfig, defaultValue)
     *
     * @this {Device}
     * @param {string} idConfig
     * @param {*} defaultValue
     * @returns {*}
     */
    getDefault(idConfig, defaultValue)
    {
        let value = this.config[idConfig];
        if (value === undefined) {
            value = defaultValue;
        } else {
            let type = typeof defaultValue;
            if (typeof value != type) {
                this.assert(false);
                if (type == "boolean") {
                    value = !!value;
                } else if (typeof defaultValue == "number") {
                    value = +value;
                }
            }
        }
        return value;
    }

    /**
     * getDefaultBoolean(idConfig, defaultValue)
     *
     * @this {Device}
     * @param {string} idConfig
     * @param {boolean} defaultValue
     * @returns {boolean}
     */
    getDefaultBoolean(idConfig, defaultValue)
    {
        return /** @type {boolean} */ (this.getDefault(idConfig, defaultValue));
    }

    /**
     * getDefaultNumber(idConfig, defaultValue)
     *
     * @this {Device}
     * @param {string} idConfig
     * @param {number} defaultValue
     * @returns {number}
     */
    getDefaultNumber(idConfig, defaultValue)
    {
        return /** @type {number} */ (this.getDefault(idConfig, defaultValue));
    }

    /**
     * getDefaultString(idConfig, defaultValue)
     *
     * @this {Device}
     * @param {string} idConfig
     * @param {string} defaultValue
     * @returns {string}
     */
    getDefaultString(idConfig, defaultValue)
    {
        return /** @type {string} */ (this.getDefault(idConfig, defaultValue));
    }

    /**
     * getURLParms(sParms)
     *
     * @this {Device}
     * @param {string} [sParms] containing the parameter portion of a URL (ie, after the '?')
     * @returns {Object} containing properties for each parameter found
     */
    getURLParms(sParms)
    {
        let parms = Device.URLParms;
        if (!parms) {
            parms = {};
            if (window) {
                if (!sParms) {
                    /*
                     * Note that window.location.href returns the entire URL, whereas window.location.search
                     * returns only the parameters, if any (starting with the '?', which we skip over with a substr() call).
                     */
                    sParms = window.location.search.substr(1);
                }
                let match;
                let pl = /\+/g; // RegExp for replacing addition symbol with a space
                let search = /([^&=]+)=?([^&]*)/g;
                let decode = function decodeParameter(s) {
                    return decodeURIComponent(s.replace(pl, " ")).trim();
                };

                while ((match = search.exec(sParms))) {
                    parms[decode(match[1])] = decode(match[2]);
                }
            }
            Device.URLParms = parms;
        }
        return parms;
    }

    /**
     * hasLocalStorage
     *
     * If localStorage support exists, is enabled, and works, return true.
     *
     * @this {Device}
     * @returns {boolean}
     */
    hasLocalStorage()
    {
        if (Device.LocalStorage.Available === undefined) {
            let f = false;
            if (window) {
                try {
                    window.localStorage.setItem(Device.LocalStorage.Test, Device.LocalStorage.Test);
                    f = (window.localStorage.getItem(Device.LocalStorage.Test) == Device.LocalStorage.Test);
                    window.localStorage.removeItem(Device.LocalStorage.Test);
                } catch(err) {
                    this.println(err.message);
                    f = false;
                }
            }
            Device.LocalStorage.Available = f;
        }
        return !!Device.LocalStorage.Available;
    }

    /**
     * isMessageOn(messages)
     *
     * If messages is MESSAGES.DEFAULT (0), then the device's default message group(s) are used,
     * and if it's MESSAGES.ALL (-1), then the message is always displayed, regardless what's enabled.
     *
     * @this {Device}
     * @param {number} [messages] is zero or more MESSAGE flags
     * @return {boolean} true if all specified message enabled, false if not
     */
    isMessageOn(messages = 0)
    {
        if (messages % 2) messages--;
        messages = messages || this.messages;
        if ((messages|1) == -1 || this.testBits(Messages, messages)) {
            return true;
        }
        return false;
    }

    /**
     * isUserAgent(s)
     *
     * Check the browser's user-agent string for the given substring; "iOS" and "MSIE" are special values you can
     * use that will match any iOS or MSIE browser, respectively (even IE11, in the case of "MSIE").
     *
     * 2013-11-06: In a questionable move, MSFT changed the user-agent reported by IE11 on Windows 8.1, eliminating
     * the "MSIE" string (which MSDN calls a "version token"; see http://msdn.microsoft.com/library/ms537503.aspx);
     * they say "public websites should rely on feature detection, rather than browser detection, in order to design
     * their sites for browsers that don't support the features used by the website." So, in IE11, we get a user-agent
     * that tries to fool apps into thinking the browser is more like WebKit or Gecko:
     *
     *      Mozilla/5.0 (Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko
     *
     * @this {Device}
     * @param {string} s is a substring to search for in the user-agent; as noted above, "iOS" and "MSIE" are special values
     * @returns {boolean} is true if the string was found, false if not
     */
    isUserAgent(s)
    {
        if (window) {
            let userAgent = window.navigator.userAgent;
            return s == "iOS" && !!userAgent.match(/(iPod|iPhone|iPad)/) && !!userAgent.match(/AppleWebKit/) || s == "MSIE" && !!userAgent.match(/(MSIE|Trident)/) || (userAgent.indexOf(s) >= 0);
        }
        return false;
    }

    /**
     * loadLocalStorage()
     *
     * @this {Device}
     * @returns {Array|null}
     */
    loadLocalStorage()
    {
        let state = null;
        if (this.hasLocalStorage()) {
            let sValue;
            if (window) {
                try {
                    sValue = window.localStorage.getItem(this.idMachine);
                    if (sValue) state = /** @type {Array} */ (JSON.parse(sValue));
                } catch (err) {
                    this.println(err.message);
                }
            }
        }
        return state;
    }

    /**
     * print(s)
     *
     * This overrides StdIO.print(), in case the device has a PRINT binding that should be used instead,
     * or if all printing should be buffered.
     *
     * @this {Device}
     * @param {string} s
     * @param {boolean} [fBuffer] (true to always buffer; otherwise, only buffer the last partial line)
     */
    print(s, fBuffer)
    {
        if (fBuffer == undefined) {
            fBuffer = this.isMessageOn(MESSAGES.BUFFER);
        }
        if (!fBuffer) {
            let element = this.findBinding(Device.BINDING.PRINT, true);
            if (element) {
                element.value += s;
                /*
                 * Prevent the <textarea> from getting too large; otherwise, printing becomes slower and slower.
                 */
                if (!DEBUG && element.value.length > 8192) {
                    element.value = element.value.substr(element.value.length - 4096);
                }
                element.scrollTop = element.scrollHeight;
                return;
            }
        }
        super.print(s, fBuffer);
    }


    /**
     * printf(format, ...args)
     *
     * This overrides StdIO.printf(), to add support for MESSAGES; if format is a number, then it's treated
     * as one or more MESSAGES flags, and the real format string is the first arg.
     *
     * @this {Device}
     * @param {string|number} format
     * @param {...} args
     */
    printf(format, ...args)
    {
        let messages = 0;
        if (typeof format == "number") {
            messages = format;
            format = args.shift();
        }
        if (this.isMessageOn(messages)) {
            super.printf(format, ...args);
        }
    }

    /**
     * removeDevice(idDevice)
     *
     * @this {Device}
     * @param {string} idDevice
     * @returns {boolean} (true if successfully removed, false if not)
     */
    removeDevice(idDevice)
    {
        let device;
        let devices = Device.Machines[this.idMachine];
        if (devices) {
            for (let i in devices) {
                if (devices[i].idDevice == idDevice) {
                    devices.splice(i, 1);
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * saveLocalStorage(state)
     *
     * @this {Device}
     * @param {Array} state
     * @returns {boolean} true if successful, false if error
     */
    saveLocalStorage(state)
    {
        if (this.hasLocalStorage()) {
            let sValue = JSON.stringify(state);
            try {
                window.localStorage.setItem(this.idMachine, sValue);
                return true;
            } catch(err) {
                this.println(err.message);
            }
        }
        return false;
    }

    /**
     * setBindingText(name, text)
     *
     * @this {Device}
     * @param {string} name
     * @param {string} text
     */
    setBindingText(name, text)
    {
        let element = this.bindings[name];
        if (element) element.textContent = text;
    }

    /**
     * setMessages(messages, on)
     *
     * Use this function to set/clear message groups.  Use isMessageOn() to decide whether to print
     * messages that are part of a group.
     *
     * MESSAGES.BUFFER is special, causing all print calls to be buffered; the print buffer will be dumped
     * as soon as setMessages() clears MESSAGES.BUFFER.
     *
     * @this {Device}
     * @param {number} messages
     * @param {boolean} on (true to set, false to clear)
     */
    setMessages(messages, on)
    {
        let flush = false;
        if (on) {
            Messages = this.setBits(Messages, messages);
        } else {
            flush = (this.testBits(Messages, MESSAGES.BUFFER) && this.testBits(messages, MESSAGES.BUFFER));
            Messages = this.clearBits(Messages, messages);
        }
        if (flush) {
            let buffer = PrintBuffer;
            PrintBuffer = "";
            this.print(buffer);
        }
    }

    /**
     * clearBits(num, bits)
     *
     * Helper function for clearing bits in numbers with more than 32 bits.
     *
     * @this {Device}
     * @param {number} num
     * @param {number} bits
     * @return {number}
     */
    clearBits(num, bits)
    {
        let shift = Math.pow(2, 32);
        let numHi = (num / shift)|0;
        let bitsHi = (bits / shift)|0;
        return (num & ~bits) + (numHi & ~bitsHi) * shift;
    }

    /**
     * setBits(num, bits)
     *
     * Helper function for setting bits in numbers with more than 32 bits.
     *
     * @this {Device}
     * @param {number} num
     * @param {number} bits
     * @return {number}
     */
    setBits(num, bits)
    {
        let shift = Math.pow(2, 32);
        let numHi = (num / shift)|0;
        let bitsHi = (bits / shift)|0;
        return (num | bits) + (numHi | bitsHi) * shift;
    }

    /**
     * testBits(num, bits)
     *
     * Helper function for testing bits in numbers with more than 32 bits.
     *
     * @this {Device}
     * @param {number} num
     * @param {number} bits
     * @return {boolean}
     */
    testBits(num, bits)
    {
        let shift = Math.pow(2, 32);
        let numHi = (num / shift)|0;
        let bitsHi = (bits / shift)|0;
        return ((num & bits) == (bits|0) && (numHi & bitsHi) == bitsHi);
    }
}

Device.BINDING = {
    CLEAR:      "clear",
    PRINT:      "print"
};

Device.COMMANDS = [
    "m\t\tenable messages"
];

Device.HANDLER = {
    COMMAND:    "command"
};

Device.Alerts = {
    list:       [],
    Version:    "version"
};

Device.LocalStorage = {
    Available:  undefined,
    Test:       "PCjs.localStorage"
};

/**
 * Handlers is a global object whose properties are machine IDs, each of which contains zero or more
 * handler IDs, each of which contains an arrays of functions.
 *
 * @type {Object}
 */
Device.Handlers = {};

/**
 * Machines is a global object whose properties are machine IDs and whose values are arrays of Devices.
 *
 * @type {Object}
 */
Device.Machines = {};
