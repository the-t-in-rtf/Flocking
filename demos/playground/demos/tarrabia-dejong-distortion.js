// Frequency-modulated saw wave by ring-modulated square wave through modulated distortion
flock.synth({
    synthDef: {
        ugen: "flock.ugen.distortion.tarrabiaDeJong",
        amount: {
            ugen: "flock.ugen.sin",
            rate: "control",
            freq: 0.25
        },
        source: {
            ugen: "flock.ugen.saw",
            freq: {
                ugen: "flock.ugen.square",
                mul: {
                    ugen: "flock.ugen.sin",
                    mul: 30,
                    freq: 2
                },
                add: 100
            }
        }
    }
});
