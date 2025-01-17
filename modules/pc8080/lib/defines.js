/**
 * @fileoverview PC8080-specific compile-time definitions.
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

/**
 * @define {string}
 */
var APPCLASS = "pc8080";        // this @define is the default application class (eg, "pcx86", "c1pjs")

/**
 * @define {string}
 */
var APPNAME = "PC8080";         // this @define is the default application name (eg, "PCx86", "C1Pjs")

/**
 * @define {boolean}
 *
 * WARNING: DEBUGGER needs to accurately reflect whether or not the Debugger component is (or will be) loaded.
 * In the compiled case, we rely on the Closure Compiler to override DEBUGGER as appropriate.  When it's *false*,
 * nearly all of debugger.js will be conditionally removed by the compiler, reducing it to little more than a
 * "type skeleton", which also solves some type-related warnings we would otherwise have if we tried to remove
 * debugger.js from the compilation process altogether.
 *
 * However, when we're in "development mode" and running uncompiled code in debugger-less configurations,
 * I would like to skip loading debugger.js altogether.  When doing that, we must ALSO arrange for an additional file
 * (nodebugger.js) to be loaded immediately after this file, which *explicitly* overrides DEBUGGER with *false*.
 */
var DEBUGGER = true;            // this @define is overridden by the Closure Compiler to remove Debugger-related support

/**
 * @define {boolean}
 *
 * BYTEARRAYS is a Closure Compiler compile-time option that allocates an Array of numbers for every Memory block,
 * where each a number represents ONE byte; very wasteful, but potentially slightly faster.
 *
 * See the Memory component for details.
 */
var BYTEARRAYS = false;

/**
 * TYPEDARRAYS enables use of typed arrays for Memory blocks.  This used to be a compile-time-only option, but I've
 * added Memory access functions for typed arrays (see Memory8080.afnTypedArray), so support can be enabled dynamically now.
 *
 * See the Memory component for details.
 */
var TYPEDARRAYS = (typeof ArrayBuffer !== 'undefined');

/*
 * Combine all the shared globals and machine-specific globals into one machine-specific global object,
 * which all machine components should start using; eg: "if (PC8080.DEBUG) ..." instead of "if (DEBUG) ...".
 */
var PC8080 = {
    APPCLASS:    APPCLASS,
    APPNAME:     APPNAME,
    APPVERSION:  APPVERSION,    // shared
    BYTEARRAYS:  BYTEARRAYS,
    COMPILED:    COMPILED,      // shared
    CSSCLASS:    CSSCLASS,      // shared
    DEBUG:       DEBUG,         // shared
    DEBUGGER:    DEBUGGER,
    MAXDEBUG:    MAXDEBUG,      // shared
    PRIVATE:     PRIVATE,       // shared
    TYPEDARRAYS: TYPEDARRAYS,
    SITEURL:     SITEURL,       // shared
    XMLVERSION:  XMLVERSION     // shared
};

if (typeof module !== "undefined") {
    global.APPCLASS    = APPCLASS;
    global.APPNAME     = APPNAME;
    global.DEBUGGER    = DEBUGGER;
    global.BYTEARRAYS  = BYTEARRAYS;
    global.TYPEDARRAYS = TYPEDARRAYS;
    global.PC8080      = PC8080;
    module.exports     = PC8080;
}
