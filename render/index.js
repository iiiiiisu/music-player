const { ipcRenderer } = require("electron")
const { Menu, MenuItem, dialog } = require("electron").remote
const remote = require("electron").remote
const fs = require("fs")
let jsmediatags = require("jsmediatags");

let menu = new Menu()
let right_clicked_tr = null

// Create a <tr></tr> Element (Song)
function template(index, name, artist = "", album = "", duration = "") {
    let tr = document.createElement("tr")
    let new_el_td = (content) => {
        let el = document.createElement("td")
        el.textContent = content
        return el
    }
    tr.appendChild(new_el_td(index))
    tr.appendChild(new_el_td(name))
    tr.appendChild(new_el_td(artist))
    tr.appendChild(new_el_td(album))
    tr.appendChild(new_el_td(duration))
    tr.setAttribute("index", index-1)
    return tr
}

function Song(src, name, artist, album, duration) {
    this.src = src
    this.name = name
    this.artist = artist
    this.album = album
    this.duration = duration
}

function Playlist() {
    this.audio = null
    this.songs = []
    this.currentIndex = -1
    this.playMode = "List Loop"
    this.length = () => {
        return this.songs.length
    }
    this.isNull = () => {
        return this.length() == 0
    }
    this.currentSong = () => {
        return this.songs[this.currentIndex]
    }
    this.add = (song) => {
        this.songs.push(song)
        if (this.currentIndex < 0) {
            this.currentIndex = 0
        }
        if(this.audio.src == "") {
            this.set()
        }
        let tmpl = template(this.length(), song.name, song.artist, song.album, song.duration)
        let tbody = document.getElementsByTagName("tbody")[0]
        tbody.appendChild(tmpl)
        ipcRenderer.send("addSong", song.src)
    }
    this.remove = (index) => {
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
    this.play = () => {
        let btn_play = document.getElementById("btn_play")
        let btn_pause = document.getElementById("btn_pause")
        this.audio.play()
        btn_play.style.display = "none"
        btn_pause.style.display = "block"
    }
    this.pause = () => {
        let btn_play = document.getElementById("btn_play")
        let btn_pause = document.getElementById("btn_pause")
        this.audio.pause()
        btn_play.style.display = "block"
        btn_pause.style.display = "none"
    }
    this.set = () => {
        this.audio.src = this.songs[this.currentIndex].src
        this.audio.load()
    }
    this.pre = () => {
        if (this.currentIndex == 0) {
            this.currentIndex = this.length() - 1
        } else {
            this.currentIndex--
        }
        this.set()
    }
    this.next = () => {
        if (this.currentIndex >= this.length() - 1) {
            this.currentIndex = 0
        } else {
            this.currentIndex++
        }
        this.set()
    }
    this.loadSrc = (src) => {
        let reader = new jsmediatags.Reader(src)
        reader.read({
            onSuccess: (tag) => {
                let audio = new Audio(src)
                audio.addEventListener("loadedmetadata", () => {
                    let duration = Math.floor(audio.duration / 60) + ":" + parseInt(audio.duration % 60)
                    let song = new Song(src, tag.tags.title, tag.tags.artist, tag.tags.album, duration)
                    this.add(song)
                })
            },
            onError: (error) => {
                console.log("err", error)
                console.log(error.type, error.info);
            }
        });
    }
    this.render = () => {
        let tbody = document.getElementsByTagName("tbody")[0]
        while(tbody.hasChildNodes()) {
            tbody.removeChild(tbody.firstChild)
        }
        for(let i in this.songs) {
            let song = this.songs[i]
            let tmpl = template(this.length(), song.name, song.artist, song.album, song.duration)
            tbody.appendChild(tmpl)
        }
    }
}
let playlist = new Playlist()
playlist.audio = document.getElementById("audio")

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
    let progress = document.getElementById("progress")
    let slider_progress = document.getElementById("progress_slider")
    let volume = document.getElementById("volume")
    let volume_value = document.getElementById("volume_value")
    let volume_slider = document.getElementById("volume_slider")
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
    btn_volume.onclick = (e) => {
        let volume_bar = document.getElementById("volume_bar")
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
            if(!isParent(volume_bar, e.target)) {
                volume_bar.style.display = "none"
                document.body.removeEventListener("click", handle)
            }
        }
        if(volume_bar.style.display == "none" || volume_bar.style.display == "") {
            volume_bar.style.display = "flex"
            e.stopPropagation()
        }
        document.body.addEventListener("click", handle)
    }
    volume.onmousedown = (e) => {
        volume.value = volume.max * e.offsetX / volume.clientWidth
        volume_value.innerText = Math.floor(volume.value)
        playlist.audio.volume = volume.value / 100
        volume_slider.style.left = e.offsetX + 10 + "px"
    }
    volume.value = playlist.audio.volume * 100
    volume_value.innerText = Math.floor(volume.value)
    volume_slider.style.left = volume.clientWidth * volume.value / volume.max + 10 + "px"
    playlist.audio.loop = false
    playlist.audio.addEventListener("timeupdate", () => {
        progress.value = playlist.audio.currentTime
        slider_progress.style.left = progress.clientWidth * progress.value / progress.max - 6 + "px"

    })
    playlist.audio.addEventListener('ended', function () {
        playlist.next()
    }, false);
    playlist.audio.oncanplay = () => {
        progress.max = audio.duration
    } 
    progress.onmousedown = (event) => {
        progress.value = progress.max * event.offsetX / progress.clientWidth
        slider_progress.style.left = event.offsetX - 6 + "px"
        playlist.audio.currentTime = progress.value
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