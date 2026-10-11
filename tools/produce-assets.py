"""One-time asset authoring; never used by the build."""
import json, pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[1]
def run(*args):
    subprocess.run([str(a) for a in args], check=True, stdout=subprocess.DEVNULL)
def rect(x,y,w,h,c):
    return dict(op='fill_rect',x=x,y=y,width=w,height=h,color=c)
def sprite(name,ops,tool='draw'):
    log=ROOT/'assets'/('snake/'+name+'.json'); log.parent.mkdir(parents=True,exist_ok=True)
    log.write_text(json.dumps(ops))
    run(tool,'render','--actions',log,'--out',log.with_suffix('.png'),'--width',32,'--height',32,'--no-layers')
# Each scale has a dark socket, a jade face, and a light-catching ridge.
body=[rect(0,6,32,20,'#124b46'),rect(0,8,32,16,'#36c9a0'),rect(0,8,32,3,'#a4f9c4'),rect(0,21,32,3,'#1a8a79')]
for x in (2,12,22):
    body += [rect(x,12,7,8,'#209f84'),rect(x,12,5,2,'#70eab0'),rect(x+5,14,2,5,'#145e59')]
sprite('body',body)
# Rounded elbow: neighbors right and below, identical edge profiles.
corner=[]
for y in range(32):
    for x in range(32):
        d=((x-31)**2+(y-31)**2)**.5
        if 7<=d<=25:
            c='#124b46' if d>23 or d<9 else '#1a8a79' if d<12 else '#a4f9c4' if d>21 else '#36c9a0'
            corner.append(rect(x,y,1,1,c))
corner += [rect(17,13,4,3,'#70eab0'),rect(12,19,3,5,'#209f84')]
sprite('corner',corner)
tail=[]
for x in range(32):
    half=min(10,1+x//3)
    tail += [rect(x,16-half,1,half*2,'#124b46'),rect(x,17-half,1,max(1,half*2-3),'#36c9a0')]
tail += [rect(19,9,13,2,'#a4f9c4'),rect(21,14,7,3,'#70eab0'),rect(11,15,6,2,'#70eab0')]
sprite('tail',tail)
for frame,gap in enumerate((0,3,7,3)):
    head=[rect(0,6,16,20,'#124b46'),rect(0,8,17,16,'#36c9a0'),rect(7,4,18,24,'#1b8878'),rect(11,3,15,26,'#89efb4'),rect(24,6,5,20,'#89efb4'),rect(29,9,3,14,'#4bcc9f'),rect(7,7,17,4,'#d5ffe1'),rect(8,23,18,3,'#30ad8e'),rect(19,7,6,6,'#102c37'),rect(22,7,3,3,'#ffffff'),rect(27,16-gap,5,2+gap*2,'#081a24'),rect(18,15-gap,10,2+gap*2,'#081a24')]
    if gap: head += [rect(23,15-gap,3,3,'#f4ffe4'),rect(23,14+gap,3,3,'#f4ffe4')]
    sprite('head/'+str(frame),head,'draw-sheet')

def config(name,duration):
    p=ROOT/'assets/audio'/f'{name}.config.json'
    p.write_text(json.dumps(dict(sample_rate=44100,channels='stereo',max_duration_ms=duration,seed=42,actions=str(ROOT/'assets/audio'/f'{name}.ops.json'),preview=f'/tmp/{name}.png',wav=str(ROOT/'assets/audio'/f'{name}.wav'),mid=str(ROOT/'assets/audio'/f'{name}.mid'))))
    return p
for name,freq,end,dur,wave in [('eat',660,990,65,'triangle'),('combo-up',1320,1980,110,'sine'),('death',160,38,650,'saw')]:
    cfg=config(name,dur)
    run('sfx-synth','--config',cfg,'init')
    run('sfx-synth','--config',cfg,'add-voice','--name','tone','--wave',wave,'--freq',freq,'--gain=-12','--dur',dur)
    run('sfx-synth','--config',cfg,'set-envelope','--voice','tone','--env','pluck')
    run('sfx-synth','--config',cfg,'set-pitch','--voice','tone','--slide-to',end,'--over',dur)
    run('sfx-synth','--config',cfg,'render')
cfg=config('music',8000)
run('music','--config',cfg,'init')
run('music','--config',cfg,'set-tempo','--bpm',120)
for track,wave,gain in [('bass','triangle',-23),('glass','sine',-27),('pulse','triangle',-30)]:
    run('music','--config',cfg,'define-track','--name',track,'--instrument',wave)
    run('music','--config',cfg,'set-track-fx','--track',track,f'--gain={gain}','--env','pluck')
for beat in range(16):
    root=[45,41,48,43][beat//4]
    run('music','--config',cfg,'add-note','--track','bass','--pitch',root,'--t',beat,'--dur',.8,'--velocity',85)
    for off in (0,.5):
        pitch=root+24+[0,7,12,7][(beat*2+int(off*2))%4]
        run('music','--config',cfg,'add-note','--track','glass','--pitch',pitch,'--t',beat+off,'--dur',.35,'--velocity',65)
    run('music','--config',cfg,'add-note','--track','pulse','--pitch',root+12,'--t',beat+.25,'--dur',.2,'--velocity',50)
run('music','--config',cfg,'render')
