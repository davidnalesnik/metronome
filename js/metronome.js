/**
    TODO:
     - use multiple sounds
     - use timestamp parameter of animation frame callback?
*/

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
        // initialize pattern -- a single beat
        pattern.push([buffer, 0.0]);
        var whereInPattern;
        var division = 1; // default = no subdivision
        // flag indicating whether we have changed tempo or changed to
        // subdivisions or back to beats only
        var handleRateChange = false;

        on.onclick = function() {
            setSecondsPerBeat();
            // local tempo; needed b/c we only change tempo by the pattern
            // statement, though the user can request a change at any time
            var patternSeconds = secondsPerBeat;
            if (!beepingInProgress) {
                /**
                    The first beep will happen slightly after the start
                    button is clicked.  We do this so that first beat is
                    not shortened -- noticeable on mobile devices
                */
                var startOffset = 0.4;
                var patternStartTime = audioCtx.currentTime + startOffset;
                // set to -1 so beepFunction loop triggers immediately
                var lastNoteTime = -1;
                var newNoteTime;
                /**
                    Set to last note of the pattern.  This is done so we
                    can begin with subdivisions.  beepFunction only allows
                    changes when we reach the last note of a pattern.  We
                    will start with the right note b/c whereInPattern is
                    immediately set to 0.
                */
                whereInPattern = pattern.length - 1;
                var newNoteEntry;
                /**
                    When a note starts playing, schedule the next one.  Because
                    of animation frames, this function will be called 60/second.
                    TODO: Somehow link this with a visual element.
                */
                var beepFunction = function() {
                    if (audioCtx.currentTime > lastNoteTime){
                        /**
                            Prints before first note sounds b/c loop always
                            schedules future events.  Also, won't print when
                            count ends.  Syncing with visual element must
                            take this into account if linked to this function.
                        */
                        console.log('beat!\n');
                        /**
                            Reset when we reach the end of the pattern.  Changes
                            of division and tempo changes happen here.
                        */
                        if (whereInPattern === pattern.length - 1) {
                            whereInPattern = 0;
                            // patternSeconds is the rate before any change
                            // first note of new pattern will be scheduled
                            // according to the old tempo
                            patternStartTime += patternSeconds;
                            if (handleRateChange) {
                                patternSeconds = secondsPerBeat;
                                updatePattern();
                                handleRateChange = false;
                            }
                        } else {
                            whereInPattern++;
                        }
                        newNoteEntry = pattern[whereInPattern];
                        newNoteTime = patternStartTime + newNoteEntry[1] * patternSeconds;
                        if (whereInPattern === 0) {
                            scheduleSound(newNoteEntry[0], newNoteTime);
                        } else {
                            scheduleOffbeatSound(newNoteEntry[0], newNoteTime);
                        }

                        lastNoteTime = newNoteTime;
                    }

                    beepingInProgress = requestAnimationFrame(beepFunction);
                };

               beepingInProgress = requestAnimationFrame(beepFunction);
            };
        };

        off.onclick = function() {
            cancelAnimationFrame(beepingInProgress);
            beepingInProgress = false;
        };

        /**
            Set a new speed.
        */
        inputBox.onchange = function() {
            setSecondsPerBeat();
            handleRateChange = true;
        };
        /**
            Subdivide
        */
        subdivide.onclick = function() {
            playSubdivisions = !playSubdivisions; // toggle

            if (playSubdivisions) {
                division = (duple.checked) ? 2 : 3;
                subdivide.innerHTML = 'subdivide off';
            } else {
                resetPattern();
                division = 1;
                subdivide.innerHTML = 'subdivide';
            }

            handleRateChange = true;
        };

        duple.onclick = function() {
            division = 2;
            if (playSubdivisions) handleRateChange = true;
        };

        triple.onclick = function() {
            division = 3;
            if (playSubdivisions) handleRateChange = true;
        };

        function updatePattern() {
            resetPattern();
            if (division > 1) {
                for(var i = 1; i < division; i++) {
                    pattern.push([buffer, i * 1/division]);
                }
            }
        };

        function resetPattern() {
            pattern = [[buffer, 0.0]];
            whereInPattern = 0; // why needed? set to 0 in beepFunction ...
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
