var on = document.getElementById('start'),
    off = document.getElementById('stop'),
    inputBox = document.querySelector('input'),
    subdivide = document.getElementById('subdivide'),
    duple = document.getElementById('duple'),
    triple = document.getElementById('triple');

var beepingInProgress = false,
    playSubdivisions = false;

var secondsPerBeat;

var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

var request = new XMLHttpRequest();
request.open('GET', 'Beep.mp3', true);
request.responseType = 'arraybuffer';

request.onload = function () {
    audioCtx.decodeAudioData(request.response, function (buffer) {
        on.onclick = function() {
            var lastScheduledTime = audioCtx.currentTime;
            setSecondsPerBeat();
            var beepFunction = function() {
                if (audioCtx.currentTime > lastScheduledTime){
                    lastScheduledTime += secondsPerBeat;
                    scheduleSound(buffer, lastScheduledTime);
                    var division = (duple.checked) ? 2 : 3;
                    if (playSubdivisions) {
                        scheduleOffbeatSound(buffer, lastScheduledTime + secondsPerBeat/division);
                    }
                    if (playSubdivisions && division === 3) {
                        scheduleOffbeatSound(buffer, lastScheduledTime + 2 * secondsPerBeat/division);
                    }
                }
                beepingInProgress = setTimeout(beepFunction, 0);
            };
            if (!beepingInProgress) {
                beepFunction();
            }
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
            playSubdivisions = false;
        };
        /**
            Subdivide
        */
        subdivide.onclick = function() {
            playSubdivisions = !playSubdivisions;
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
