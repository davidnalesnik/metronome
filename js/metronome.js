var on = document.getElementById('start'),
    off = document.getElementById('stop'),
    inputBox = document.querySelector('input'),
    subdivide = document.getElementById('subdivide'),
    duple = document.getElementById('duple'),
    triple = document.getElementById('triple');

var beepingInProgress = false,
    playSubdivisions = false;

var secondsPerBeat;
/**
    an object storing sounds and their location within the pattern.  Location
    is expressed as a floating-point number between 0.0 and 1.0.  This will
    be multiplied by the seconds-per-beat to give the offset in seconds.
    [[buffer1, fraction1], [buffer2, fraction2]]
*/
var pattern = [];

var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

var request = new XMLHttpRequest();
request.open('GET', 'Beep.mp3', true);
request.responseType = 'arraybuffer';

request.onload = function () {
    audioCtx.decodeAudioData(request.response, function (buffer) {
        pattern.push([buffer, 0.0]);
        var whereInPattern;
        var division = 2;
        on.onclick = function() {
            setSecondsPerBeat();
            if (!beepingInProgress) {
                var lastScheduledPatternTime = audioCtx.currentTime;
                var lastScheduledNoteTime = audioCtx.currentTime;
                /**
                    Set to -1 so first note heard when beepFunction first called
                    (whereInPattern is initially incremented).
                */
                whereInPattern = -1;
                var currentPatternElement;
                /**
                    When a note starts playing, schedule the next one.
                */
                var beepFunction = function() {
                    if (audioCtx.currentTime >= lastScheduledNoteTime){
                        /**
                            Reset when we reach the end of the pattern.
                        */
                        if (whereInPattern === pattern.length - 1) {
                            whereInPattern = 0;
                            lastScheduledPatternTime += secondsPerBeat;
                        } else {
                            whereInPattern++;
                        }
                        currentPatternElement = pattern[whereInPattern];
                        lastScheduledNoteTime = lastScheduledPatternTime + currentPatternElement[1] * secondsPerBeat;
                        scheduleSound(currentPatternElement[0], lastScheduledNoteTime);
                    }
                    beepingInProgress = setTimeout(beepFunction, 0);
                };

                beepFunction();
            };
        };

        off.onclick = function() {
            clearTimeout(beepingInProgress);
            beepingInProgress = false;
        };

        /**
            Set a new speed.
        */
        inputBox.onchange = function() {
            setSecondsPerBeat();
            //resetPattern();
            playSubdivisions = false;
        };
        /**
            Subdivide
        */
        subdivide.onclick = function() {
            playSubdivisions = !playSubdivisions;
            if (playSubdivisions) {
                updatePattern();
            } else {
                resetPattern();
            }
        };

        duple.onclick = function() {
            division = 2;
            if (playSubdivisions) {
                updatePattern();
            }
        };

        triple.onclick = function() {
            division = 3;
            if (playSubdivisions) {
                updatePattern();
            }
        };

        function updatePattern() {
            resetPattern();
            for(var i = 1; i < division; i++) {
                pattern.push([buffer, i * 1/division]);
            }
        };

        function resetPattern() {
            pattern = [[buffer, 0.0]];
            whereInPattern = 0;
        };
    });
};

request.send();

function scheduleSound(buffer, time) {
    var bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(audioCtx.destination);
    bufferSource.start(time);
}

function scheduleOffbeatSound(buffer, time) {
    var bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = buffer;
    var gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.2;
    bufferSource.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    bufferSource.start(time);
}

function setSecondsPerBeat() {
    var beatsPerMinute = document.getElementById('bpm').value;
    secondsPerBeat = 60/beatsPerMinute;
}
