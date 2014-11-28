/*
* Flocking Browser-Dependent Unit Generators
* http://github.com/colinbdclark/flocking
*
* Copyright 2013-2014, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global require, Float32Array, window*/
/*jshint white: false, newcap: true, regexp: true, browser: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");

    fluid.registerNamespace("flock.ugen");

    /***************************
     * Browser-dependent UGens *
     ***************************/

    flock.ugen.scope = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                spf = m.spf,
                bufIdx = m.bufIdx,
                buf = m.scope.values,
                i;

            for (i = 0; i < numSamps; i++) {
                buf[bufIdx] = that.inputs.source.output[i];
                if (bufIdx < spf) {
                    bufIdx += 1;
                } else {
                    bufIdx = 0;
                    that.scopeView.refreshView();
                }
            }
            m.bufIdx = bufIdx;
        };

        that.onInputChanged = function () {
            // Pass the "source" input directly back as the output from this ugen.
            that.output = that.inputs.source.output;
        };

        that.init = function () {
            that.model.spf = Math.round(that.model.sampleRate / that.options.fps);
            that.model.bufIdx = 0;

            // Set up the scopeView widget.
            that.model.scope = that.options.styles;
            that.model.scope.values = new Float32Array(that.model.spf);
            that.scopeView = flock.view.scope(that.options.canvas, that.model.scope);

            that.onInputChanged();
            that.scopeView.refreshView();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.scope", {
        rate: "audio",
        inputs: {
            source: null
        },
        ugenOptions: {
            fps: 60,
            styles: {
                strokeColor: "#777777",
                strokeWidth: 1
            }
        }
    });


    flock.ugen.mouse = {};

    /**
     * Tracks the mouse's position along the specified axis within the boundaries the whole screen.
     * This unit generator will generate a signal between 0.0 and 1.0 based on the position of the mouse;
     * use the mul and add inputs to scale this value to an appropriate control signal.
     */
    flock.ugen.mouse.cursor = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        /**
         * Generates a control rate signal between 0.0 and 1.0 by tracking the mouse's position along the specified axis.
         *
         * @param numSamps the number of samples to generate
         */
        that.exponentialGen = function (numSamps) {
            var m = that.model,
                val = flock.ugen.mouse.cursor.normalize(that.target, m),
                movingAvg = m.movingAvg,
                lag = that.inputs.lag.output[0],
                add = that.inputs.add.output[0],
                mul = that.inputs.mul.output[0],
                lagCoef = m.lagCoef,
                out = that.output,
                i,
                max;

            if (lag !== lagCoef) {
                lagCoef = lag === 0 ? 0.0 : Math.exp(flock.LOG001 / (lag * m.sampleRate));
                m.lagCoef = lagCoef;
            }

            for (i = 0; i < numSamps; i++) {
                max = mul + add;
                val = Math.pow(max  / add, val) * add;
                movingAvg = val + lagCoef * (movingAvg - val); // 1-pole filter averages mouse values.
                out[i] = movingAvg;
            }

            m.movingAvg = movingAvg;
        };

        that.linearGen = function (numSamps) {
            var m = that.model,
                val = flock.ugen.mouse.cursor.normalize(that.target, m),
                movingAvg = m.movingAvg,
                lag = that.inputs.lag.output[0],
                add = that.inputs.add.output[0],
                mul = that.inputs.mul.output[0],
                lagCoef = m.lagCoef,
                out = that.output,
                i;

            if (lag !== lagCoef) {
                lagCoef = lag === 0 ? 0.0 : Math.exp(flock.LOG001 / (lag * m.sampleRate));
                m.lagCoef = lagCoef;
            }

            for (i = 0; i < numSamps; i++) {
                movingAvg = val + lagCoef * (movingAvg - val);
                out[i] = movingAvg * mul + add;
            }

            m.movingAvg = movingAvg;
        };

        that.noInterpolationGen = function (numSamps) {
            var val = flock.ugen.mouse.cursor.normalize(that.target, that.model),
                i;

            for (i = 0; i < numSamps; i++) {
                that.output[i] = val * that.inputs.mul.output[0] + that.inputs.add.output[0];
            }
        };

        that.moveListener = function (e) {
            var m = that.model;
            m.mousePosition = e[m.eventProp];
        };

        that.overListener = function () {
            that.model.isWithinTarget = true;
        };

        that.outListener = function () {
            var m = that.model;
            m.isWithinTarget = false;
            m.mousePosition = 0.0;
        };

        that.downListener = function () {
            that.model.isMouseDown = true;
        };

        that.upListener = function () {
            var m = that.model;
            m.isMouseDown = false;
            m.mousePosition = 0;
        };

        that.moveWhileDownListener = function (e) {
            if (that.model.isMouseDown) {
                that.moveListener(e);
            }
        };

        that.bindEvents = function () {
            var target = that.target,
                moveListener = that.moveListener;

            if (that.options.onlyOnMouseDown) {
                target.mousedown(that.downListener);
                target.mouseup(that.upListener);
                moveListener = that.moveWhileDownListener;
            }

            target.mouseover(that.overListener);
            target.mouseout(that.outListener);
            target.mousemove(moveListener);
        };

        that.onInputChanged = function () {
            flock.onMulAddInputChanged(that);

            var interp = that.options.interpolation;
            that.gen = interp === "none" ? that.noInterpolationGen :
                interp === "exponential" ? that.exponentialGen : that.linearGen;
        };

        that.init = function () {
            var m = that.model,
                options = that.options,
                axis = options.axis,
                target = $(options.target || window);

            if (axis === "x" || axis === "width" || axis === "horizontal") {
                m.eventProp = "clientX";
                m.offsetProp = "left";
                m.dimension = "width";
            } else {
                m.eventProp = "clientY";
                m.offsetProp = "top";
                m.dimension = "height";
            }

            that.target = target;
            m.mousePosition = 0;
            m.movingAvg = 0;

            that.bindEvents();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugen.mouse.cursor.normalize = function (target, m) {
        if (!m.isWithinTarget) {
            return 0.0;
        }

        var size = target[m.dimension](),
            offset = target.offset(),
            pos = m.mousePosition;

        if (offset) {
            pos -= offset[m.offsetProp];
        }

        return pos / size;
    };

    fluid.defaults("flock.ugen.mouse.cursor", {
        rate: "control",
        inputs: {
            lag: 0.5,
            add: 0.0,
            mul: 1.0
        },

        ugenOptions: {
            axis: "x",
            interpolation: "linear",
            model: {
                mousePosition: 0,
                movingAvg: 0
            }
        }
    });


    flock.ugen.mouse.click = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var out = that.output,
                m = that.model,
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = m.value;
            }

            that.mulAdd(numSamps);
        };

        that.mouseDownListener = function () {
            that.model.value = 1.0;
        };

        that.mouseUpListener = function () {
            that.model.value = 0.0;
        };

        that.init = function () {
            var m = that.model;
            m.target = typeof (that.options.target) === "string" ?
                document.querySelector(that.options.target) : that.options.target || window;
            m.value = 0.0;
            m.target.addEventListener("mousedown", that.mouseDownListener, false);
            m.target.addEventListener("mouseup", that.mouseUpListener, false);

            that.onInputChanged();
        };

        that.onInputChanged = function () {
            flock.onMulAddInputChanged(that);
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.mouse.click", {
        rate: "control"
    });


    flock.ugen.mediaIn = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        // TODO: Complete cut and paste of flock.ugen.audioIn,
        // which is a cut and paste job of flock.ugen.in.singleBusGen().
        that.gen = function (numSamps) {
            var out = that.output,
                busNum = that.inputs.bus.output[0] | 0,
                bus = that.options.audioSettings.buses[busNum],
                i;

            for (i = 0; i < numSamps; i++) {
                out[i] = bus[i];
            }

            that.mulAdd(numSamps);
        };

        that.onInputChanged = function () {
            flock.onMulAddInputChanged(that);
        };

        that.init = function () {
            var mediaEl = $(that.options.selector)[0];
            // TODO: Direct reference to the shared environment.
            flock.enviro.shared.audioStrategy.inputManager.openMediaElement(mediaEl);
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.mediaIn", {
        rate: "audio",
        inputs: {
            bus: 2,
            mul: null,
            add: null
        },
        ugenOptions: {
            selector: "audio"
        }
    });
}());
