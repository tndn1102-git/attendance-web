# -*- coding: utf-8 -*-
"""EP07 경량 계측(demucs 없음) — 전조·밝기(7k)·꼬리 리프트·인트로·온셋밀도·꼬리길이"""
import io, os, sys, json, subprocess
import numpy as np, librosa
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
SRC = r'D:\test3\suno-sleep-yt\ballad90\ep11\_regen'
SR = 22050

def dec(p):
    c=['ffmpeg','-v','error','-i',p,'-f','f32le','-acodec','pcm_f32le','-ac','1','-ar',str(SR),'-']
    return np.frombuffer(subprocess.run(c,capture_output=True).stdout,dtype='<f4').astype(np.float32)

res={}
for f in sorted(x for x in os.listdir(SRC) if x.lower().endswith('.mp3')):
    p=os.path.join(SRC,f); y=dec(p); dur=len(y)/SR
    # ---- 프레임 에너지 / 대역
    S=np.abs(librosa.stft(y,n_fft=2048,hop_length=512))**2
    fps=SR/512; fr=librosa.fft_frequencies(sr=SR,n_fft=2048)
    def band(lo,hi): 
        m=(fr>=lo)&(fr<hi); return S[m].sum(0)
    tot=S.sum(0); low=band(80,300); mid=band(300,3400); hi7=band(7000,11000); hi4=band(4000,11000)
    rms=np.sqrt(tot/ S.shape[0])
    thr=np.percentile(rms,80)*0.01
    idx=np.where(rms>thr)[0]
    end=(idx[-1]+1)/fps if len(idx) else dur
    start=idx[0]/fps if len(idx) else 0.0
    tail_sil=dur-end
    # ---- 밝기 (곡 전체, 음악 구간만)
    m_music=(np.arange(len(tot))/fps>=start)&(np.arange(len(tot))/fps<=end)
    hf7=10*np.log10(hi7[m_music].sum()/ (band(200,2000)[m_music].sum()+1e-12)+1e-12)
    hf4=10*np.log10(hi4[m_music].sum()/ (band(200,2000)[m_music].sum()+1e-12)+1e-12)
    # ---- 창: MID(40%~+25s) / TAIL(end-40~end-8)
    def win(a,b,arr):
        i0,i1=int(a*fps),int(b*fps); seg=arr[i0:i1]; return seg
    def dbm(arr,a,b):
        seg=win(a,b,arr); return 10*np.log10(seg.mean()+1e-12)
    ma,mb=dur*0.40,dur*0.40+25; ta,tb=max(0,end-40),end-8
    lift_full=dbm(tot,ta,tb)-dbm(tot,ma,mb)
    lift_mid=dbm(mid,ta,tb)-dbm(mid,ma,mb)     # 보컬 대역 근사
    lift_low=dbm(low,ta,tb)-dbm(low,ma,mb)
    # ---- 온셋 밀도(보컬 대역 300~3400 근사)
    yh=librosa.effects.preemphasis(y)
    oenv=librosa.onset.onset_strength(y=yh,sr=SR,hop_length=512,fmin=300,fmax=3400,n_mels=64)
    on=librosa.onset.onset_detect(onset_envelope=oenv,sr=SR,hop_length=512,units='time',
                                  delta=0.25,wait=3)
    on_mid=[t for t in on if ma<=t<=mb]
    dens=len(on_mid)/25.0
    # ---- 인트로(첫 보컬 근사): 중역/저역 비가 곡 중앙값 -6dB 를 처음 넘어 2초 지속
    r_mid=10*np.log10(mid+1e-12); r_low=10*np.log10(low+1e-12)
    ratio=r_mid-r_low
    med=np.median(ratio[int(ma*fps):int(mb*fps)])
    ok=ratio>(med-3)
    intro=None
    need=int(2*fps)
    i=int(start*fps)
    while i<len(ok)-need:
        if ok[i:i+need].all(): intro=i/fps; break
        i+=1
    # ---- 전조 타임라인
    C=librosa.feature.chroma_cqt(y=y,sr=SR,bins_per_octave=36,hop_length=2048)
    cfps=SR/2048; W=int(8*cfps); STEP=max(1,int(0.5*cfps))
    def norm(v):
        v=v-v.mean(); return v/(np.linalg.norm(v)+1e-9)
    ref=norm(C[:,:int(end*0.60*cfps)].mean(1))
    times,shifts,marg=[],[],[]
    for i in range(0,C.shape[1]-W,STEP):
        v=norm(C[:,i:i+W].mean(1))
        cs=np.array([float(np.dot(np.roll(ref,s),v)) for s in range(12)])
        b=int(np.argmax(cs)); sh=b if b<=6 else b-12
        srt=np.sort(cs)[::-1]
        times.append(i/cfps); shifts.append(sh); marg.append(float(srt[0]-srt[1]))
    times=np.array(times); shifts=np.array(shifts); marg=np.array(marg)
    tailm=(times>=end-45)&(times<=end-6); bodym=(times>=30)&(times<=end*0.60)
    conf=marg>0.25
    t_sh=shifts[tailm&conf]; b_sh=shifts[bodym&conf]
    frac1=float(np.mean(t_sh==1)) if len(t_sh) else float('nan')
    fracb=float(np.mean(b_sh==1)) if len(b_sh) else float('nan')
    res[f]=dict(dur=dur,song_end=end,first=start,tail_sil=tail_sil,hf7=float(hf7),hf4=float(hf4),
                lift_full=float(lift_full),lift_voc=float(lift_mid),lift_low=float(lift_low),
                onset_dens=float(dens),intro=intro,
                key_tail_p1=frac1,key_body_p1=fracb,key_n=len(t_sh))
    print(f"{f:28s} end{end:6.1f} sil{tail_sil:5.1f} hf7{hf7:7.2f} liftV{lift_mid:+5.2f} "
          f"liftF{lift_full:+5.2f} dens{dens:5.2f} intro{(intro or -1):6.1f} +1꼬리{frac1:5.0%}/본체{fracb:4.0%}",flush=True)
json.dump(res,io.open(os.path.join(SRC,'_lite_regen.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)
