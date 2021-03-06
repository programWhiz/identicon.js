/**
 * Identicon.js 2.0.0
 * http://github.com/stewartlord/identicon.js
 *
 * PNGLib required for PNG output
 * http://www.xarg.org/download/pnglib.js
 *
 * Copyright 2016, Stewart Lord
 * Released under the BSD license
 * http://www.opensource.org/licenses/bsd-license.php
 */

(function() {
    var PNGlib;
    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        PNGlib = require('./pnglib');
    } else {
        PNGlib = window.PNGlib;
    }

    var Identicon = function(hash, options){
        this.defaults = {
            background: [240, 240, 240, 255],
            margin:     0.08,
            size:       64,
            format:     'png',
            numCells:   5
        };

        this.options = typeof(options) === 'object' ? options : this.defaults;

        // backward compatibility with old constructor (hash, size, margin)
        if (typeof(arguments[1]) === 'number') { this.options.size   = arguments[1]; }
        if (arguments[2])                      { this.options.margin = arguments[2]; }

        this.hash        = hash                    || this.defaultHash();
        this.background  = this.options.background || this.defaults.background;
        this.margin      = this.options.margin     || this.defaults.margin;
        this.size        = this.options.size       || this.defaults.size;
        this.format      = this.options.format     || this.defaults.format;
        this.numCells    = this.options.numCells   || this.defaults.numCells;
      
        if( this.numCells < 0 ){
          throw new Error('Number of cells must be positive.');
        }
        if( this.numCells % 2 != 1 ) {
          throw new Error('Number of cells must be odd.');
        }

        // foreground defaults to last 7 chars as hue at 50% saturation, 70% brightness
        var hue          = parseInt(this.hash.substr(-7), 16) / 0xfffffff;
        this.foreground  = this.options.foreground || this.hsl2rgb(hue, 0.5, 0.7);
    };

    Identicon.prototype = {
        background: null,
        foreground: null,
        hash:       null,
        margin:     null,
        size:       null,
        format:     null,
        numCells:   null,

        image: function(){
            return this.isSvg()
                ? new Svg(this.size, this.foreground, this.background)
                : new PNGlib(this.size, this.size, 256);
        },

        render: function(){
            var image      = this.image(),
                size       = this.size,
                baseMargin = Math.floor(size * this.margin),
                numCells   = this.numCells,
                cell       = Math.floor((size - (baseMargin * 2)) / numCells),
                margin     = Math.floor((size - cell * numCells) / 2);
                bg         = image.color.apply(image, this.background),
                fg         = image.color.apply(image, this.foreground);

            var halfWidth = (numCells-1) / 2;
            var i, j, hashIdx;
            for( i = 0; i < numCells; ++i ){
              for( j = 0; j <= halfWidth; ++j ){
                // Different possible color for each column in image
                hashIdx = (i * halfWidth + j) % this.hash.length;
                color = parseInt(this.hash.charAt(hashIdx), 16) % 2 ? bg : fg;
                this.rectangle(j * cell + margin, i * cell + margin, cell, cell, color, image);
                this.rectangle((numCells - 1 - j) * cell + margin, i * cell + margin, cell, cell, color, image);
              }
            } 

            return image;
        },

        rectangle: function(x, y, w, h, color, image){
            if (this.isSvg()) {
                image.rectangles.push({x: x, y: y, w: w, h: h, color: color});
            } else {
                var i, j;
                for (i = x; i < x + w; i++) {
                    for (j = y; j < y + h; j++) {
                        image.buffer[image.index(i, j)] = color;
                    }
                }
            }
        },

        // adapted from: https://gist.github.com/aemkei/1325937
        hsl2rgb: function(h, s, b){
            h *= 6;
            s = [
                b += s *= b < .5 ? b : 1 - b,
                b - h % 1 * s * 2,
                b -= s *= 2,
                b,
                b + h % 1 * s,
                b + s
            ];

            return[
                s[ ~~h    % 6 ] * 255, // red
                s[ (h|16) % 6 ] * 255, // green
                s[ (h|8)  % 6 ] * 255  // blue
            ];
        },

        toString: function(){
            return this.render().getBase64();
        },

        defaultHash: function(){
            return this.createHashFromString((new Date()).toISOString());
        },

        // Creates a consistent-length hash from a string
        createHashFromString: function(str){
            var hash = '0', salt = 'identicon', i, chr, len;

            if (!str) {
                return hash;
            }

            str += salt + str; // Better randomization for short inputs.

            for (i = 0, len = str.length; i < len; i++) {
                chr   = str.charCodeAt(i);
                hash  = ((hash << 5) - hash) + chr;
                hash |= 0; // Convert to 32bit integer
            }
            return hash.toString();
        },

        isSvg: function(){
            return this.format.match(/svg/i)
        }
    };

    var Svg = function(size, foreground, background){
        this.size       = size;
        this.foreground = this.color.apply(this, foreground);
        this.background = this.color.apply(this, background);
        this.rectangles = [];
    };

    Svg.prototype = {
        size:       null,
        foreground: null,
        background: null,
        rectangles: null,

        color: function(r, g, b, a){
            var values = [r, g, b, a ? a/255 : 1].map(Math.round);
            return 'rgba(' + values.join(',') + ')';
        },

        getBase64: function(){
            var i,
                xml,
                rect,
                fg     = this.foreground,
                bg     = this.background,
                stroke = this.size * 0.005;

            xml = '<svg xmlns="http://www.w3.org/2000/svg"'
                + ' width="' + this.size + '" height="' + this.size + '"'
                + ' style="background-color:' + bg + ';">'
                + '<g style="fill:' + fg + '; stroke:' + fg + '; stroke-width:' + stroke + ';">';

            for (i = 0; i < this.rectangles.length; i++) {
                rect = this.rectangles[i];
                if (rect.color == bg) continue;
                xml += '<rect '
                    + ' x="'      + rect.x + '"'
                    + ' y="'      + rect.y + '"'
                    + ' width="'  + rect.w + '"'
                    + ' height="' + rect.h + '"'
                    + '/>';
            }

            xml += '</g></svg>';

            return btoa(xml);
        }
    };

    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        module.exports = Identicon;
    } else {
        window.Identicon = Identicon;
    }
})();
