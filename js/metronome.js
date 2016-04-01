//beep = document.getElementById('beep');

//on = document.getElementById('start');
//off = document.getElementById('stop');

//var beeping;

/*on.onclick = function() {
    clearInterval(beeping);
    var bpm = document.getElementById('bpm').value;
    var ms = clickTime(bpm);
    beeping = setInterval(function() {
    beep.currentTime = 0;
    beep.play();
    }, ms);
    };

    off.onclick = function() {
    clearInterval(beeping);
    };

    // Stop metronome if user changes tabs or hides window. Otherwise, browser may
    // run process at a different rate.  See
    //http://stackoverflow.com/questions/15871942/how-do-browsers-pause-change-javascript-when-tab-or-window-is-not-active
    document.addEventListener('visibilitychange', function(){
    clearInterval(beeping);
    });

    // convert beats per minute to milliseconds per beat
    function clickTime(bpm) {
    return 60000/bpm;
    }

/*************************************************************/
var on = document.getElementById('start'),
    off = document.getElementById('stop'),
    inputBox = document.querySelector('input'),
    subdivide = document.getElementById('subdivide'),
    duple = document.getElementById('duple'),
    triple = document.getElementById('triple');

var playSubdivisions = false,
    beepingStarted = false,
    secondsPerBeep;

var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

var request = new XMLHttpRequest();
request.open('GET', 'Beep.mp3', true);
request.responseType = 'arraybuffer';

request.onload = function () {
    audioCtx.decodeAudioData(request.response, function (buffer) {
        /**
            If the metronome is already going, pressing the start button
            will simply update the rate as the beep continues.
        */
        on.onclick = function() {
            setSecondsPerBeat();
            if (!beepingStarted) {
                beepingStarted = true;
                playBeatLoop(buffer, audioCtx.currentTime, secondsPerBeep);
            }
        };
        /**
            Set a new speed.
        */
        inputBox.onchange = function() {
            setSecondsPerBeat();
            playSubdivisions = false;
        };

        off.onclick = function() {
            beepingStarted = false;
        };
        /** Subdivide */
        subdivide.onclick = function() {
            playSubdivisions = !playSubdivisions;
        };
    });
};

request.send();

function setSecondsPerBeat() {
    var beatsPerMinute = document.getElementById('bpm').value;
    secondsPerBeep = 60/beatsPerMinute;
}

function playBeatLoop(buffer, time) {
    if (beepingStarted) {
        var bufferSource = audioCtx.createBufferSource();
        bufferSource.buffer = buffer;
        bufferSource.connect(audioCtx.destination);
        bufferSource.start(time);
        /**
            When first beep has played, schedule another one.  We do this
            so that metronome is responsive to 'stop' button and rate
            changes.  (There is some sluggishness as a further beep has already
            been scheduled when user presses stop--unless 'stop' has been
            pressed while beep is in progress!)
        */
        bufferSource.onended = function() {
            playBeatLoop(buffer, time + secondsPerBeep, secondsPerBeep);
        };
        if (playSubdivisions) {
            playSubdivisionLoop(buffer, time);
        }
    };
}

function playSubdivisionLoop(buffer, time) {
    var division = (duple.checked) ? 2 : 3;
    var bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(audioCtx.destination);
    bufferSource.start(time);
    bufferSource.onended = function() {
        if (playSubdivisions) {
            bufferSource = audioCtx.createBufferSource();
            bufferSource.buffer = buffer;
            bufferSource.connect(audioCtx.destination);
            bufferSource.start(time + secondsPerBeep/division);
            bufferSource.onended = function() {
                if (division === 3 && playSubdivisions) {
                    bufferSource = audioCtx.createBufferSource();
                    bufferSource.buffer = buffer;
                    bufferSource.connect(audioCtx.destination);
                    bufferSource.start(time + 2 * secondsPerBeep/division);
                }
            }
        }
    };
}
