/**
 * @fileoverview PDP10-specific compile-time definitions.
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
var APPCLASS = "pdp10";         // this @define is the default application class (eg, "pcx86", "c1pjs")

/**
 * APPNAME is used more for display purposes than anything else now.  APPCLASS is what matters in terms
 * of folder and file names, CSS styles, etc.
 *
 * @define {string}
 */
var APPNAME = "PDPjs";          // this @define is the default application name (eg, "PCx86", "C1Pjs")

/**
 * WARNING: DEBUGGER needs to accurately reflect whether or not the Debugger component is (or will be) loaded.
 * In the compiled case, we rely on the Closure Compiler to override DEBUGGER as appropriate.  When it's *false*,
 * nearly all of debugger.js will be conditionally removed by the compiler, reducing it to little more than a
 * "type skeleton", which also solves some type-related warnings we would otherwise have if we tried to remove
 * debugger.js from the compilation process altogether.
 *
 * However, when we're in "development mode" and running uncompiled code in debugger-less configurations,
 * I would like to skip loading debugger.js altogether.  When doing that, we must ALSO arrange for an additional file
 * (nodebugger.js) to be loaded immediately after this file, which *explicitly* overrides DEBUGGER with *false*.
 *
 * @define {boolean}
 */
var DEBUGGER = true;            // this @define is overridden by the Closure Compiler to remove Debugger-related support

/*
 * Set this to true to enable behavior compatible with SIMH.
 */
var SIMH = false;

/*
 * Combine all the shared globals and machine-specific globals into one machine-specific global object,
 * which all machine components should start using; eg: "if (PDP10.DEBUG) ..." instead of "if (DEBUG) ...".
 */
var PDP10 = {
    APPCLASS:   APPCLASS,
    APPNAME:    APPNAME,
    APPVERSION: APPVERSION,     // shared
    COMPILED:   COMPILED,       // shared
    CSSCLASS:   CSSCLASS,       // shared
    DEBUG:      DEBUG,          // shared
    DEBUGGER:   DEBUGGER,
    MAXDEBUG:   MAXDEBUG,       // shared
    PRIVATE:    PRIVATE,        // shared
    SITEURL:    SITEURL,        // shared
    XMLVERSION: XMLVERSION,     // shared

    /*
     * CPU model numbers (supported)
     */
    MODEL_KA10: 1001,

    /*
     * ADDR_INVALID is used to mark points in the code where the physical address being returned
     * is invalid and should not be used.
     *
     * In a 32-bit CPU, -1 (ie, 0xffffffff) could actually be a valid address, so consider changing
     * ADDR_INVALID to NaN or null (which is also why all ADDR_INVALID tests should use strict equality
     * operators).
     *
     * The main reason I'm NOT using NaN or null now is my concern that, by mixing non-numbers
     * (specifically, values outside the range of signed 32-bit integers), performance may suffer.
     *
     * WARNING: Like many of the properties defined here, ADDR_INVALID is a common constant, which the
     * Closure Compiler will happily inline (with or without @const annotations; in fact, I've yet to
     * see a @const annotation EVER improve automatic inlining).  However, if you don't make ABSOLUTELY
     * certain that this file is included BEFORE the first reference to any of these properties, that
     * automatic inlining will no longer occur.
     */
    ADDR_INVALID:   -1,
    ADDR_MASK:      Math.pow(2, 18) - 1,
    ADDR_LIMIT:     Math.pow(2, 18),

    /*
     * 18-bit and 36-bit largest positive (and smallest negative) values; however, since we store all
     * values as unsigned quantities, these are the unsigned equivalents.
     */
    WORD_INVALID:   -1,
    HINT_MASK:      Math.pow(2, 17) - 1,        //         131,071          (377777)  signed half-word (half-int) mask
    HINT_LIMIT:     Math.pow(2, 17),            //         131,072          (400000)  signed half-word (half-int) limit
    HALF_MASK:      Math.pow(2, 18) - 1,        //         262,143   (000000 777777): unsigned half-word mask
    HALF_SHIFT:     Math.pow(2, 18),            //         262,144   (000001 000000): unsigned half-word shift
    INT_MASK:       Math.pow(2, 35) - 1,        //  34,359,738,367   (377777 777777): signed word (magnitude) mask
    INT_LIMIT:      Math.pow(2, 35),            //  34,359,738,368   (400000 000000): signed word (magnitude) limit
    WORD_MASK:      Math.pow(2, 36) - 1,        //  68,719,476,735   (777777 777777): unsigned word mask
    WORD_LIMIT:     Math.pow(2, 36),            //  68,719,476,736 (1 000000 000000): unsigned word limit

    TWO_POW32:      Math.pow(2, 32),
    TWO_POW34:      Math.pow(2, 34),
    TWO_POW36:      Math.pow(2, 36),            // the two's complement of a 36-bit value is (value? TWO_POW36 - value : 0)

    /*
     * PDP-10 opcodes are 36-bit values, most of which use the following layout:
     *
     *                          1 1 1 1 1 1 1 1 1 1 2 2 2 2 2 2 2 2 2 2 3 3 3 3 3 3
     *      0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5
     *      O O O O O O O M M A A A A I X X X X Y Y Y Y Y Y Y Y Y Y Y Y Y Y Y Y Y Y
     *
     * or using modern bit-numbering:
     *
     *      3 3 3 3 3 3 2 2 2 2 2 2 2 2 2 2 1 1 1 1 1 1 1 1 1 1
     *      5 4 3 2 1 0 9 8 7 6 5 4 3 2 1 0 9 8 7 6 5 4 3 2 1 0 9 8 7 6 5 4 3 2 1 0
     *      O O O O O O O M M A A A A I X X X X Y Y Y Y Y Y Y Y Y Y Y Y Y Y Y Y Y Y
     *
     * where OOOOOOOMM represents the operation, and MM (if used) represents the mode:
     *
     *      Mode        Suffix      Source  Destination
     *      ----        ------      -----   -----------
     *  0:  Basic       None        E       AC
     *  1:  Immediate   I           0,E     AC
     *  2:  Memory      M           AC      E
     *  3:  Self/Both   S or B      E       E (and AC if A is non-zero)
     *
     * Input-output instructions look like:
     *
     *      3 3 3 3 3 3 2 2 2 2 2 2 2 2 2 2 1 1 1 1 1 1 1 1 1 1
     *      5 4 3 2 1 0 9 8 7 6 5 4 3 2 1 0 9 8 7 6 5 4 3 2 1 0 9 8 7 6 5 4 3 2 1 0
     *      1 1 1 D D D D D D D O O O I X X X X Y Y Y Y Y Y Y Y Y Y Y Y Y Y Y Y Y Y
     *
     * Bits 0-22 (I,X,Y) contain what we call a "reference address" (R), which is used to calculate the
     * "effective address" (E).  To determine E from R, we must extract I, X, and Y from R, set E to Y,
     * then add [X] to E if X is non-zero.  If I is zero, then we're done; otherwise, we must set R to [E]
     * and repeat the process.
     */
    OPCODE: {
        OPMASK:     0o77700,            // operation mask
        OPMODE:     0o77400,            // operation with mode
        OPCOMP:     0o77000,            // operation with compare
        OPTEST:     0o71100,            // operation with test
        OPIO:       0o70034,            // input-output operation
        OPUUO:      0o70000,            // unimplemented user operation (UUO) mask
        OP_SCALE:   Math.pow(2, 21),    // operation scale
        IO_SCALE:   Math.pow(2, 26),    // input-output device code scale
        IO_MASK:    0o177,              // input-output device code mask (after descale)
        A_SCALE:    Math.pow(2, 23),    // used to shift down the high 13 bits, with A starting at bit 0
        P_SCALE:    Math.pow(2, 30),    // P scale
        P_MASK:     0o77,               // P mask (after descale)
        S_SHIFT:    24,                 // S shift
        S_MASK:     0o77,               // S mask (after shift)
        A_SHIFT:    23,                 // A shift
        A_MASK:     0o17,               // A mask (after shift)
        A_FIELD:    0o740000000,        // A field mask
        I_FIELD:    0o20000000,         // indirect bit mask
        X_SHIFT:    18,                 // X shift
        X_MASK:     0o17,               // X mask (after shift)
        X_FIELD:    0o17000000,         // X field mask
        Y_SHIFT:    0,                  // Y shift
        Y_MASK:     0o777777,           // Y mask (after shift)
        Y_FIELD:    0o777777,           // Y field mask
        R_MASK:     0o37777777,         // used to isolate the low 23 bits (I,X,Y)
        PTR_MASK:   0o77777777,         // used to isolate the low 24 bits (?,I,X,Y) of a byte pointer
        HALT:       0o5304              // operation code for HALT
    },

    /*
     * Internal operation state flags
     */
    OPFLAG: {
        IRQ_DELAY:  0x0001,             // incremented until it becomes IRQ
        IRQ:        0x0002,             // time to call checkInterrupts()
        IRQ_MASK:   0x0003,
        DEBUGGER:   0x0004,             // set if the Debugger wants to perform checks
        WAIT:       0x0008,             // WAIT operation in progress
        PRESERVE:   0x000F              // OPFLAG bits to preserve prior to the next instruction
    },

    /*
     * Flags returned by getPS() for various program control operations.
     *
     * NOTE: I see SIMH setting PS bits like 0o000200 and 0o000400, which are not documented for the KA10.
     * The SIMH docs only refer to the KS10 ("KS10 CPU with 1MW of memory"), so I'm guessing it doesn't have
     * a KA10 emulation option.  The `pdp10` SIMH binary does have some SET CPU options, but unlike the `pdp11`
     * binary, the only options you can set relate to the operating system to be run -- which seems very hacky.
     */
    PSFLAG: {
        AROV:       0o400000,           // Arithmetic Overflow
        CRY0:       0o200000,           // Carry 0
        CRY1:       0o100000,           // Carry 1
        FOV:        0o040000,           // Floating-Point Overflow
        BIS:        0o020000,           // Byte Interrupt
        USERF:      0o010000,           // User Mode Flag
        EXIOT:      0o004000,           // User Privileged I/O Flag
        FXU:        0o000100,           // Floating-Point Underflow
        DCK:        0o000040,           // Divide Check (aka No Divide)
        /*
         * Only the low 18 bits (above) are returned by getPS(); the following (bits 18 to 31)
         * are defined for internal use only.
         */
        PDOV:      0o1000000,           // Pushdown Overflow
        SET_MASK:  0o0760140            // flags that are always settable/clearable
    },

    /*
     * Readable CPU (or APR for "Arithmetic Processor") flags provided by the "CONI APR," instruction; see opCONI().
     */
    RFLAG: {
        PIA:        0o000007,           // Priority Interrupt Assignment
        AROV:       0o000010,           // Arithmetic Overflow
        AROV_IE:    0o000020,           // Arithmetic Overflow Interrupt Enabled
        TRAP_OFF:   0o000040,           // Trap Offset
        FOV:        0o000100,           // Floating-Point Overflow
        FOV_IE:     0o000200,           // Floating-Point Overflow Interrupt Enabled
        CLK:        0o001000,           // Clock Flag
        CLK_IE:     0o002000,           // Clock Interrupt Enabled
        NXM:        0o010000,           // Non-Existent Memory
        PRM:        0o020000,           // Memory Protection
        ADB:        0o040000,           // Address Break
        UIO:        0o100000,           // User In-Out
        PDOV:       0o200000            // Pushdown Overflow (TODO: Verify this is correct; the May 1968 doc may have a typo)
    },

    /*
     * Writable CPU (or APR for "Arithmetic Processor") flags provided by the "CONO APR," instruction; see opCONO().
     *
     * A set bit performs the function shown below, a clear bit does nothing.
     */
    WFLAG: {
        PIA:        0o000007,           // Priority Interrupt Assignment
        AROV_CL:    0o000010,           // Clear Overflow
        AROV_IE:    0o000020,           // Enable Overflow Interrupt
        AROV_ID:    0o000040,           // Disable Overflow Interrupt
        FOV_CL:     0o000100,           // Clear Floating-Point Overflow
        FOV_IE:     0o000200,           // Enable Floating-Point Overflow Interrupt
        FOV_ID:     0o000400,           // Disable Floating-Point Overflow Interrupt
        CLK_CL:     0o001000,           // Clear Clock Flag
        CLK_IE:     0o002000,           // Enable Clock Interrupt
        CLK_ID:     0o004000,           // Disable Clock Interrupt
        NXM_CL:     0o010000,           // Clear Non-Existent Memory
        PRM_CL:     0o020000,           // Clear Memory Protection
        ADB_CL:     0o040000,           // Clear Address Break
        UIO_CL:     0o200000,           // Clear All In-Out Devices
        PDOV_CL:    0o400000            // Clear Pushdown Overflow
    },

    /*
     * 7-bit device codes used by Input-Output instructions; see opIO().
     */
    DEVICES: {
        APR:        0o000,              // Arithmetic Processor
        PI:         0o001               // Priority Interrupt
    }
};

/*
 * Combine all the shared globals and machine-specific globals into one machine-specific global object,
 * which all machine components should start using; eg: "if (PDP10.DEBUGGER)" instead of "if (DEBUGGER)".
 */
PDP10.APPCLASS          = APPCLASS;
PDP10.APPNAME           = APPNAME;
PDP10.DEBUGGER          = DEBUGGER;
PDP10.SIMH              = SIMH;

if (typeof module !== "undefined") {
    global.APPCLASS     = APPCLASS;
    global.APPNAME      = APPNAME;
    global.DEBUGGER     = DEBUGGER;
    global.SIMH         = SIMH;
    global.PDP10        = PDP10;
    module.exports      = PDP10;
}
