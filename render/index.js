const { ipcRenderer } = require("electron")
const { Menu, MenuItem, dialog } = require("electron").remote
const remote = require("electron").remote
const fs = require("fs")
let jsmediatags = require("jsmediatags");

let menu = new Menu()
let right_clicked_tr = null

class MyProgress {
    constructor(box, progress, slider) {
        this.box = box
        this.progress = progress
        this.slider = slider
        this.valueChanged = null
        this.isDragging = false
        this.getOffsetLeft = () => {
            let obj = this.box
            let offsetLeft = this.box.offsetLeft
            while(obj = obj.offsetParent){
                offsetLeft += obj.offsetLeft
            }
            return offsetLeft
        }
        this.box.onmousedown = (e) => {
            this.isDragging = true
            let offsetLeft = this.getOffsetLeft()
            this.progress.value = this.progress.max * (e.clientX - offsetLeft) / this.progress.clientWidth
            this.slider.style.left = (this.getValue() / this.progress.max *
             this.progress.clientWidth - this.slider.clientWidth / 2) + "px"
            let mousemove = (e) => {
                let pos = e.clientX
                if ( pos < offsetLeft) {
                    pos = offsetLeft
                } else if (pos > offsetLeft + this.progress.clientWidth){
                    pos = offsetLeft + this.progress.clientWidth
                }
                this.progress.value = this.progress.max * (pos - offsetLeft) / this.progress.clientWidth
                this.slider.style.left = (pos - offsetLeft - this.slider.clientWidth / 2) + "px"
            }
            document.addEventListener("mousemove", mousemove)
            let mouseup = (e) => {
                if (this.valueChanged){
                    this.valueChanged()
                }
                document.removeEventListener("mousemove", mousemove)
                this.isDragging = false
                document.removeEventListener("mouseup", mouseup)
            }
            document.addEventListener("mouseup", mouseup)
        }
    }

    setValue(value) {
        if (this.isDragging){
            return
        }
        console.log(value)
        this.progress.value = value
        console.log(value, this.progress.clientWidth, this.progress.max, this.slider.clientWidth / 2)
        this.slider.style.left = (value * this.progress.clientWidth / this.progress.max - this.slider.clientWidth / 2) + "px"
        console.log(this.slider, this.slider.style.left)
    }

    getValue() {
        return this.progress.value
    }
}

class Song {
    constructor(src, name, artist, album, duration, cover) {
        this.src = src
        this.name = name
        this.artist = artist
        this.album = album
        this.duration = duration
        this.cover = cover
    }

    render(index) {
        let tr = document.createElement("tr")
        let new_el_td = (content) => {
            let el = document.createElement("td")
            el.textContent = content
            return el
        }
        tr.appendChild(new_el_td(index))
        tr.appendChild(new_el_td(this.name))
        tr.appendChild(new_el_td(this.artist))
        tr.appendChild(new_el_td(this.album))
        tr.appendChild(new_el_td(this.duration))
        tr.setAttribute("index", index-1)
        return tr
    }

    toString() {
        return `歌名：${song.name}\n`
                 + `艺术家：${song.artist}\n`
                 + `专辑：${song.album}\n`
                 + `时长：${song.duration}\n`
                 + `文件路径：${song.src}`
    }
}

class Playlist {
    constructor(audio, progress) {
        this.audio = null
        if (audio) {
            this.audio = audio
            this.setAudio()
        }
        this.progress = progress
        this.songs = []
        this.currentIndex = -1
        this.playMode = "List Loop"
    }
    length() {
        return this.songs.length
    }
    isNull() {
        return this.length() == 0
    }
    currentSong() {
        return this.songs[this.currentIndex]
    }
    add(song) {
        this.songs.push(song)
        if (this.currentIndex < 0) {
            this.currentIndex = 0
        }
        if(this.audio.src == "") {
            this.set()
        }
        let tbody = document.getElementsByTagName("tbody")[0]
        tbody.appendChild(song.render(this.length()))
        ipcRenderer.send("addSong", song.src)
    }
    remove(index) {
        if (this.currentIndex == index) {
            this.pause()
        }
        let src = this.songs[index].src
        this.songs.splice(index, 1)
        this.currentIndex --
        this.next()
        this.render()
        ipcRenderer.send("delSong", {
            src: src,
            index: index
        })
    }
    play() {
        let btn_play = document.getElementById("btn_play")
        let btn_pause = document.getElementById("btn_pause")
        this.audio.play()
        btn_play.style.display = "none"
        btn_pause.style.display = "block"
    }
    pause() {
        let btn_play = document.getElementById("btn_play")
        let btn_pause = document.getElementById("btn_pause")
        this.audio.pause()
        btn_play.style.display = "block"
        btn_pause.style.display = "none"
    }
    set() {
        this.audio.src = this.currentSong().src
        this.audio.load()
        let cover = document.getElementById("song_cover")
        cover.src = 'data:image/png;base64,'+ this.currentSong().cover;
        document.getElementById("song_name").innerText = this.currentSong().name
        document.getElementById("song_artist").innerText = this.currentSong().artist
    }
    pre() {
        if (this.currentIndex == 0) {
            this.currentIndex = this.length() - 1
        } else {
            this.currentIndex--
        }
        this.set()
    }
    next() {
        if (this.currentIndex >= this.length() - 1) {
            this.currentIndex = 0
        } else {
            this.currentIndex++
        }
        this.set()
    }
    loadSrc(src) {
        let reader = new jsmediatags.Reader(src)
        reader.read({
            onSuccess: (tag) => {
                let binary = ""
                let bytes = new Uint8Array(tag.tags.picture.data)
                for (let i=0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i])
                }
                let cover = window.btoa(binary)
                
                let audio = new Audio(src)
                audio.addEventListener("loadedmetadata", () => {
                    let duration = Math.floor(audio.duration / 60) + ":" + parseInt(audio.duration % 60)
                    let song = new Song(src, tag.tags.title, tag.tags.artist, tag.tags.album, duration, cover)
                    this.add(song)
                })
            },
            onError: (error) => {
                console.log("err", error)
                console.log(error.type, error.info);
            }
        });
    }
    render(tbody) {
        while(tbody.hasChildNodes()) {
            tbody.removeChild(tbody.firstChild)
        }
        for(let i in this.songs) {
            let song = this.songs[i]
            let tmpl = template(this.length(), song.name, song.artist, song.album, song.duration)
            tbody.appendChild(tmpl)
        }
    }
    setAudio() {
        this.audio.loop = false
        this.audio.addEventListener("timeupdate", () => {
            this.progress.setValue(this.audio.currentTime)
        })
        this.audio.addEventListener('ended', () => {
            this.next()
            this.play()
        }, false);
        this.audio.oncanplay = () => {
            this.progress.progress.max = this.audio.duration
        } 
    }
}

let audio_progress = new MyProgress(
    document.getElementById("audio_progress_box"),
    document.getElementById("audio_progress"),
    document.getElementById("audio_slider"),
)
audio_progress.valueChanged = function() {
    document.getElementById("audio").currentTime = this.getValue()
}
let playlist = new Playlist(document.getElementById("audio"), audio_progress)
function initMenu() {
    menu.append(new MenuItem({label: "播放", click: (e) => {
        let index = Number(right_clicked_tr.getAttribute("index"))
        playlist.currentIndex = index
        playlist.set()
        playlist.play()
    }}))
    menu.append(new MenuItem({type: "separator"}))
    menu.append(new MenuItem({label: "从歌单删除", click: (e) => {
        let index = Number(right_clicked_tr.getAttribute("index"))
        playlist.remove(index)
    }}))
    menu.append(new MenuItem({label: "从本地删除", click: (e) => {
        let index = Number(right_clicked_tr.getAttribute("index"))
        let src = playlist.songs[index].src
        playlist.remove(index)
        fs.unlink(src, (err) => {
            if (err){
                console.log(err)
            }
        })
    }}))
    menu.append(new MenuItem({type: "separator"}))
    menu.append(new MenuItem({label: "歌曲信息", click: (e) => {
        let index = Number(right_clicked_tr.getAttribute("index"))
        let song = playlist.songs[index]
        let info = "歌名：" + song.name + "\n"
                 + "艺术家：" + song.artist + "\n"
                 + "专辑：" + song.album + "\n"
                 + "时长：" + song.duration + "\n"
                 + "文件路径：" +song.src

        alert(info)
    }}))
}

window.onload = () => {
    let btn_play = document.getElementById("btn_play")
    let btn_pause = document.getElementById("btn_pause")
    let btn_pre = document.getElementById("btn_pre_song")
    let btn_next = document.getElementById("btn_next_song")
    let btn_volume = document.getElementById("btn_volume")
    let btn_add_song = document.getElementById("btn_add")

    initMenu()
    ipcRenderer.on("InitPlaylist", (event, args) => {
        for (let i in args) {
            playlist.loadSrc(args[i])
        }
    })
    btn_play.onclick = () => {
        if (playlist.audio.paused) {
            playlist.play()
        }
    }
    btn_pause.onclick = () => {
        if (!playlist.audio.paused) {
            playlist.pause()
        }
    }
    btn_pre.onclick = () => {
        playlist.pre()
        playlist.play()
    }
    btn_next.onclick = ()=> {
        playlist.next()
        playlist.play()
    }
    let volume_progress = new MyProgress(
        document.getElementById("volume_progress_box"),
        document.getElementById("volume_progress"),
        document.getElementById("volume_slider"),
    )
    volume_progress.setValue(playlist.audio.volume*100)
    volume_progress.valueChanged = function(){
        let value_text = document.getElementById("volume_value")
        value_text.innerText = Math.floor(this.getValue())
        document.getElementById("audio").volume = this.getValue() / 100
    }
    btn_volume.onclick = (e) => {
        let volume_box = document.getElementsByClassName("volume-box")[0]
        function isParent(p, c) {
            let obj = c
            while(obj != undefined && obj != null && obj.tagName.toUpperCase() != 'BODY') {
                if (p == obj) {
                    return true
                }
                obj = obj.parentNode
            }
            return false
        }
        let handle = (e) => {
            if(!isParent(volume_box, e.target)) {
                volume_box.style.display = "none"
                document.body.removeEventListener("click", handle)
            }
        }
        if(volume_box.style.display == "none" || volume_box.style.display == "") {
            volume_progress.setValue(playlist.audio.volume * 100)
            volume_progress.valueChanged()
            volume_box.style.display = "flex"
            e.stopPropagation()
        }
        document.body.addEventListener("click", handle)
    }
    btn_add_song.onclick = () => {
        dialog.showOpenDialog({
            title: '添加歌曲',
            defaultPath: "",
            buttonLabel: "确认添加",
            filters: [
                {
                    name: 'mp3',
                    extensions: ['mp3', 'wav']
                }
            ],
            properties: ["multiSelections"],
        }).then((res) => {
            for (let i in res.filePaths) {
                playlist.loadSrc(res.filePaths[i])
            }
        })
    }
    document.getElementsByTagName("tbody")[0].addEventListener("contextmenu", (e) => {
        e.preventDefault()
        let t = e.target
        while (t.tagName != "TR") {
            t = t.parentNode
        }
        right_clicked_tr = t
        menu.popup(remote.getCurrentWindow())
    }, false)
}