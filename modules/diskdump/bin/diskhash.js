#!/usr/bin/env node
/**
 * @fileoverview Disk image hashing tool
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

var fs = require("fs");
var path = require("path");
var crypto = require('crypto');

var Str = require("../../shared/lib/strlib");
var Proc = require("../../shared/lib/proclib");
var args = Proc.getArgs();

/**
 * printf(format, ...args)
 *
 * @param {string} format
 * @param {...} args
 */
function printf(format, ...args)
{
    process.stdout.write(Str.sprintf(format, ...args));
}

/**
 * findFile(buf, name)
 *
 * @param {Buffer} buf
 * @param {string} name
 * @return {number} (offset of directory entry for file, or -1 if not found)
 */
function findFile(buf, name = "*")
{
    let off = 0x600;
    let offMax = 0x800;
    while (off < offMax) {
        let i = 0, src = "";
        for (; i < 11; i++) {
            let b = buf[off+i];
            if (i == 0 && (b == 0xE5 || b == 0x00)) break;
            let ch = String.fromCharCode(b);
            if (ch == " ") {
                if (i > 7) break;
                i = 7;
                continue;
            }
            src += (i == 8? "." : "") + ch;
        }
        if (!src) {
            off = offMax;
            break;
        }
        if (src == name || name == "*") {
            let time = buf[off+0x16] | (buf[off+0x17] << 8);
            let hour = (time >> 11) & 0x1f;
            let minute = (time >> 5) & 0x3f;
            let second = (time & 0x1f) << 1;
            printf("%-12s %02d:%02d:%02d (%#06x)\n", src, hour, minute, second, time);
        }
        if (src == name) break;
        off += 0x20;
    }
    if (off >= offMax) off = -1;
    return off;
}

/**
 * setFileTime(buf, off, hour, minute, second)
 *
 * @param {Buffer} buf
 * @param {number} off
 * @param {number} hour (-1 to leave unchanged)
 * @param {number} minute (-1 to leave unchanged)
 * @param {number} second (-1 to leave unchanged)
 */
function setFileTime(buf, off, hour = -1, minute = -1, second = -1)
{
    let time = buf[off+0x16] | (buf[off+0x17] << 8);
    if (hour >= 0) {
        time = (time & 0x07ff) | ((hour & 0x1f) << 11);
    }
    if (minute >= 0) {
        time = (time & 0xf81f) | ((minute & 0x3f) << 5);
    }
    if (second >= 0) {
        time = (time & 0xffe0) | (second >> 1) & 0x1f;
    }
    buf[off+0x16] = time & 0xff;
    buf[off+0x17] = (time >> 8) & 0xff;
}

/**
 * processDisk(sDisk)
 *
 * @param {string} sDisk
 */
function processDisk(sDisk)
{
    let bufData, shaHash, sumData, off;

    try {
        bufData = fs.readFileSync(sDisk);
    } catch(err) {
        printf("error: unable to read disk image: %s\n", sDisk);
        return;
    }

    findFile(bufData, "*");

    let off1 = findFile(bufData, "EDLIN.COM");
    let off2 = findFile(bufData, "README.DOC");
    if (off1 >= 0 && off2 >= 0) {
        let sec1 = 0;
        setFileTime(bufData, off1, 9, 31, 0);
        // setFileTime(bufData, off2, -1, -1, 22);
        findFile(bufData, "README.DOC");
        while (sec1 < 60) {
            setFileTime(bufData, off1, -1, -1, sec1);
            findFile(bufData, "EDLIN.COM");
            shaHash = crypto.createHash('sha1');
            shaHash.update(bufData);
            sumData = shaHash.digest('hex');
            printf("%s  %s\n", sumData, path.basename(sDisk));
            sec1 += 2;
        }
    }
}

if (args.argc > 1) {
    var argv = args.argv;
    processDisk(argv[1]);
    process.exit(0);
}

printf("usage: node diskhash.js [disk image]\n");
