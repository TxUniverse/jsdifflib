/***
This is part of jsdifflib v1.0. <http://snowtide.com/jsdifflib>

Copyright (c) 2007, Snowtide Informatics Systems, Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

	* Redistributions of source code must retain the above copyright notice, this
		list of conditions and the following disclaimer.
	* Redistributions in binary form must reproduce the above copyright notice,
		this list of conditions and the following disclaimer in the documentation
		and/or other materials provided with the distribution.
	* Neither the name of the Snowtide Informatics Systems nor the names of its
		contributors may be used to endorse or promote products derived from this
		software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
DAMAGE.
***/
/* Author: Chas Emerick <cemerick@snowtide.com> */
(function (root, factory) {
  if(typeof define === "function" && define.amd) {
    define([], function(){
      return (root.diffLib = factory());
    });
  } else if(typeof module === "object" && module.exports) {
    module.exports = (root.diffLib = factory())
  } else {
    root.diffLib = factory()
  }
}(this, function() {
  let __whitespace = {" ":true, "\t":true, "\n":true, "\f":true, "\r":true}

  return {
    stripLineBreaks: function (str) {
      return str.replace(/^[\n\r]*|[\n\r]*$/g, "")
    },

    stringAsLines: function (str) {
      let lfpos = str.indexOf("\n")
      let crpos = str.indexOf("\r")
      let linebreak = ((lfpos > -1 && crpos > -1) || crpos < 0) ? "\n" : "\r"

      let lines = str.split(linebreak)
      for (let i = 0; i < lines.length; i++) {
        lines[i] = diffLib.stripLineBreaks(lines[i])
      }

      return lines
    },

    getDiff: function(txtARaw, txtBRaw, isJunk) {
      let txtA = diffLib.stringAsLines(txtARaw)
      let txtB = diffLib.stringAsLines(txtBRaw)
      let sm = diffLib.sequenceMatcher(txtA, txtB, isJunk)
      let opCodes = diffLib.get_opcodes(sm)

      let dataLines = []

      for (let idx = 0; idx < opCodes.length; idx++) {
        let code = opCodes[idx]
        let change = code[0]
        let b = code[1]
        let be = code[2]
        let n = code[3]
        let ne = code[4]
        let rowCount = Math.max(be - b, ne - n)
        for (let i = 0; i < rowCount; i++) {
          // jump ahead if we've already provided leading context or if this is the first range
          if (opCodes.length > 1 && ((idx > 0 ) || (idx === 0 && i === 0)) && change === "equal") {
            let jump = rowCount - ((idx === 0 ? 1 : 2))
            if (jump > 1) {
              b += jump
              n += jump
              i += jump - 1
              // skip last lines if they're all equal
              if (idx + 1 === opCodes.length) {
                break
              } else {
                continue
              }
            }
          }

          if (change === "insert") {
            dataLines.push({line: n, text: txtB[n], change})
            n++
          }
          else if (change === "replace") {
            if (b < be) {
              dataLines.push({line: b, change: 'delete'})
              b++
            }
            if (n < ne) {
              dataLines.push({line: n, text: txtB[n], change: 'insert'})
              n++
            }
          } else if (change === "delete") {
            dataLines.push({line: b, text: txtA[b], change})
            b++
          }
        }
      }

      return dataLines
    },

    applyChanges: function (dataLines, current) {
      let txt = diffLib.stringAsLines(current)

      if (dataLines.length > 0) {

        let diffLine = 0
        for (let i = 0; i < dataLines.length; i++) {
          if (dataLines[i].change === 'delete') {
            txt.splice(dataLines[i].line + diffLine--, 1)
          }
        }
        for (let i = 0; i < dataLines.length; i++) {
          if (dataLines[i].change === 'insert') {
            txt.splice(dataLines[i].line, 0, dataLines[i].text)
          }
        }
      }
      return txt.join('\n')
    },

    sequenceMatcher: function (a, b, isjunk) {
      this.set_seqs = function (a, b) {
        this.set_seq1(a)
        this.set_seq2(b)
      }

      this.set_seq1 = function (a) {
        if (a === this.a) return
        this.a = a
        this.matching_blocks = this.opcodes = null
      }

      this.set_seq2 = function (b) {
        if (b === this.b) return
        this.b = b
        this.matching_blocks = this.opcodes = this.fullbCount = null
        this.__chain_b()
      }

      this.__chain_b = function () {
        let b = this.b
        let n = b.length
        let b2j = this.b2j = {}
        let populardict = {}
        for (let i = 0; i < b.length; i++) {
          let elt = b[i]
          if (b2j.hasOwnProperty(elt)) {
            let indices = b2j[elt]
            if (n >= 200 && indices.length * 100 > n) {
              populardict[elt] = 1
              delete b2j[elt]
            } else {
              indices.push(i)
            }
          } else {
            b2j[elt] = [i]
          }
        }

        for (let elt in populardict) {
          if (populardict.hasOwnProperty(elt)) {
            delete b2j[elt]
          }
        }

        let isjunk = this.isjunk
        let junkdict = {}
        if (isjunk) {
          for (let elt in populardict) {
            if (populardict.hasOwnProperty(elt) && isjunk(elt)) {
              junkdict[elt] = 1
              delete populardict[elt]
            }
          }
          for (let elt in b2j) {
            if (b2j.hasOwnProperty(elt) && isjunk(elt)) {
              junkdict[elt] = 1
              delete b2j[elt]
            }
          }
        }

        this.isbjunk = diffLib.__isindict(junkdict)
        this.isbpopular = diffLib.__isindict(populardict)
      }

      this.find_longest_match = function (alo, ahi, blo, bhi) {
        let a = this.a
        let b = this.b
        let b2j = this.b2j
        let isbjunk = this.isbjunk
        let besti = alo
        let bestj = blo
        let bestsize = 0
        let j = null
        let k

        let j2len = {}
        let nothing = []
        for (let i = alo; i < ahi; i++) {
          let newj2len = {}
          let jdict = diffLib.__dictget(b2j, a[i], nothing)
          for (let jkey in jdict) {
            if (jdict.hasOwnProperty(jkey)) {
              j = jdict[jkey]
              if (j < blo) continue
              if (j >= bhi) break
              newj2len[j] = k = diffLib.__dictget(j2len, j - 1, 0) + 1
              if (k > bestsize) {
                besti = i - k + 1
                bestj = j - k + 1
                bestsize = k
              }
            }
          }
          j2len = newj2len
        }

        while (besti > alo && bestj > blo && !isbjunk(b[bestj - 1]) && a[besti - 1] === b[bestj - 1]) {
          besti--
          bestj--
          bestsize++
        }

        while (besti + bestsize < ahi && bestj + bestsize < bhi &&
        !isbjunk(b[bestj + bestsize]) &&
        a[besti + bestsize] === b[bestj + bestsize]) {
          bestsize++
        }

        while (besti > alo && bestj > blo && isbjunk(b[bestj - 1]) && a[besti - 1] === b[bestj - 1]) {
          besti--
          bestj--
          bestsize++
        }

        while (besti + bestsize < ahi && bestj + bestsize < bhi && isbjunk(b[bestj + bestsize]) &&
        a[besti + bestsize] === b[bestj + bestsize]) {
          bestsize++
        }

        return [besti, bestj, bestsize]
      }

      this.get_matching_blocks = function () {
        if (this.matching_blocks !== null) return this.matching_blocks
        let la = this.a.length
        let lb = this.b.length

        let queue = [[0, la, 0, lb]]
        let matching_blocks = []
        let alo, ahi, blo, bhi, qi, i, j, k, x
        while (queue.length) {
          qi = queue.pop()
          alo = qi[0]
          ahi = qi[1]
          blo = qi[2]
          bhi = qi[3]
          x = this.find_longest_match(alo, ahi, blo, bhi)
          i = x[0]
          j = x[1]
          k = x[2]

          if (k) {
            matching_blocks.push(x)
            if (alo < i && blo < j)
              queue.push([alo, i, blo, j])
            if (i + k < ahi && j + k < bhi)
              queue.push([i + k, ahi, j + k, bhi])
          }
        }

        matching_blocks.sort(diffLib.__ntuplecomp)

        let i1 = 0, j1 = 0, k1 = 0, block = 0
        let i2, j2, k2
        let non_adjacent = []
        for (let idx in matching_blocks) {
          if (matching_blocks.hasOwnProperty(idx)) {
            block = matching_blocks[idx]
            i2 = block[0]
            j2 = block[1]
            k2 = block[2]
            if (i1 + k1 === i2 && j1 + k1 === j2) {
              k1 += k2
            } else {
              if (k1) non_adjacent.push([i1, j1, k1])
              i1 = i2
              j1 = j2
              k1 = k2
            }
          }
        }

        if (k1) non_adjacent.push([i1, j1, k1])

        non_adjacent.push([la, lb, 0])
        this.matching_blocks = non_adjacent
        return this.matching_blocks
      }

      this.get_opcodes = function () {
        if (this.opcodes !== null) return this.opcodes
        let i = 0
        let j = 0
        let answer = []
        this.opcodes = answer
        let block, ai, bj, size, tag
        let blocks = this.get_matching_blocks()
        for (let idx in blocks) {
          if (blocks.hasOwnProperty(idx)) {
            block = blocks[idx]
            ai = block[0]
            bj = block[1]
            size = block[2]
            tag = ''
            if (i < ai && j < bj) {
              tag = 'replace'
            } else if (i < ai) {
              tag = 'delete'
            } else if (j < bj) {
              tag = 'insert'
            }
            if (tag) answer.push([tag, i, ai, j, bj])
            i = ai + size
            j = bj + size

            if (size) answer.push(['equal', ai, i, bj, j])
          }
        }

        return answer
      }

      // this is a generator function in the python lib, which of course is not supported in javascript
      // the reimplementation builds up the grouped opcodes into a list in their entirety and returns that.
      this.get_grouped_opcodes = function (n) {
        if (!n) n = 3
        let codes = this.get_opcodes()
        if (!codes) codes = [["equal", 0, 1, 0, 1]]
        let code, tag, i1, i2, j1, j2
        if (codes[0][0] === 'equal') {
          code = codes[0]
          tag = code[0]
          i1 = code[1]
          i2 = code[2]
          j1 = code[3]
          j2 = code[4]
          codes[0] = [tag, Math.max(i1, i2 - n), i2, Math.max(j1, j2 - n), j2]
        }
        if (codes[codes.length - 1][0] === 'equal') {
          code = codes[codes.length - 1]
          tag = code[0]
          i1 = code[1]
          i2 = code[2]
          j1 = code[3]
          j2 = code[4]
          codes[codes.length - 1] = [tag, i1, Math.min(i2, i1 + n), j1, Math.min(j2, j1 + n)]
        }

        let nn = n + n
        let group = []
        let groups = []
        for (let idx in codes) {
          if (codes.hasOwnProperty(idx)) {
            code = codes[idx]
            tag = code[0]
            i1 = code[1]
            i2 = code[2]
            j1 = code[3]
            j2 = code[4]
            if (tag === 'equal' && i2 - i1 > nn) {
              group.push([tag, i1, Math.min(i2, i1 + n), j1, Math.min(j2, j1 + n)])
              groups.push(group)
              group = []
              i1 = Math.max(i1, i2 - n)
              j1 = Math.max(j1, j2 - n)
            }

            group.push([tag, i1, i2, j1, j2])
          }
        }

        if (group && !(group.length === 1 && group[0][0] === 'equal')) groups.push(group)

        return groups
      }

      this.ratio = function () {
        let matches = diffLib.__reduce(
          function (sum, triple) {
            return sum + triple[triple.length - 1]
          },
          this.get_matching_blocks(), 0)
        return diffLib.__calculate_ratio(matches, this.a.length + this.b.length)
      }

      this.quick_ratio = function () {
        let fullbCount, elt
        if (this.fullbCount === null) {
          this.fullbCount = fullbCount = {}
          for (let i = 0; i < this.b.length; i++) {
            elt = this.b[i]
            fullbCount[elt] = diffLib.__dictget(fullbCount, elt, 0) + 1
          }
        }
        fullbCount = this.fullbCount

        let avail = {}
        let availhas = diffLib.__isindict(avail)
        let matches = numb = 0
        for (let i = 0; i < this.a.length; i++) {
          elt = this.a[i]
          if (availhas(elt)) {
            numb = avail[elt]
          } else {
            numb = diffLib.__dictget(fullbCount, elt, 0)
          }
          avail[elt] = numb - 1
          if (numb > 0) matches++
        }

        return diffLib.__calculate_ratio(matches, this.a.length + this.b.length)
      }

      this.real_quick_ratio = function () {
        let la = this.a.length
        let lb = this.b.length
        return _calculate_ratio(Math.min(la, lb), la + lb)
      }

      this.isjunk = isjunk ? isjunk : diffLib.defaultJunkFunction
      this.a = this.b = null
      this.set_seqs(a, b)
    },

    // iteration-based reduce implementation
    __reduce: function (func, list, initial) {
      let value = null
      let idx = null

      if (initial !== null) {
        value = initial
        idx = 0
      } else if (list) {
        value = list[0]
        idx = 1
      } else {
        return null
      }

      for (; idx < list.length; idx++) {
        value = func(value, list[idx])
      }

      return value
    },

    defaultJunkFunction: function (c) {
      return __whitespace.hasOwnProperty(c)
    },

    // comparison function for sorting lists of numeric tuples
    __ntuplecomp: function (a, b) {
      let mlen = Math.max(a.length, b.length)
      for (let i = 0; i < mlen; i++) {
        if (a[i] < b[i]) return -1
        if (a[i] > b[i]) return 1
      }

      return a.length === b.length ? 0 : (a.length < b.length ? -1 : 1)
    },

    __calculate_ratio: function (matches, length) {
      return length ? 2.0 * matches / length : 1.0
    },

    // returns a function that returns true if a key passed to the returned function
    // is in the dict (js object) provided to this function; replaces being able to
    // carry around dict.has_key in python...
    __isindict: function (dict) {
      return function (key) {
        return dict.hasOwnProperty(key)
      }
    },

    // replacement for python's dict.get function -- need easy default values
    __dictget: function (dict, key, defaultValue) {
      return dict.hasOwnProperty(key) ? dict[key] : defaultValue
    }
  }
}))