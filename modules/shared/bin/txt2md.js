#!/usr/bin/env node
/**
 * @fileoverview Tool for converting text files to Markdown files
 * @author <a href="mailto:Jeff@pcjs.org">Jeff Parsons</a>
 * @copyright © 2012-2019 Jeff Parsons
 * @suppress {missingProperties}
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
var Defines = require("../lib/defines");
var Str = require("../lib/strlib");

/**
 * processFile(sInputFile, sOutputFile)
 *
 * @param {string} sInputFile
 * @param {string} [sOutputFile]
 */
function processFile(sInputFile, sOutputFile)
{
    try {
        let sNew = "";
        let sText = fs.readFileSync(sInputFile, "binary");
        let aLines = sText.split(/(?:^|\r?\n) ?/);
        for (let l = 0; l < aLines.length;) {
            let sNewLine = "";
            let sLine = aLines[l++];
            for (let i = 0; i < sLine.length;) {
                let chCode = sLine.charCodeAt(i++);
                //
                // 0x7F was used as a hyperlinking character; we simply remove it for now.  Ditto for 0x1E.
                //
                if (chCode == 0x7F || chCode == 0x1E) continue;
                let chNew = Str.CP437ToUnicode[chCode];
                if (/* chCode == 0x09 || */ chNew === undefined) {
                    throw new Error("line " + l + ", pos " + i + ": unrecognized character (" + chCode + ")");
                }
                sNewLine += chNew;
            }
            if (!sOutputFile) {
                console.log(sNewLine);
            } else {
                sNew += '\t' + sNewLine + '\n';
            }
        }
        if (sOutputFile) {
            fs.writeFileSync(sOutputFile, sNew);
        }
    }
    catch(err) {
        console.log(err.message);
    }
}

if (process.argv.length <= 2) {
    console.log("usage: node txt2md [input filename] [output filename]");
    process.exit();
}

processFile(process.argv[2], process.argv[3]);
