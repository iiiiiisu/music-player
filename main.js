const { ipcMain } = require('electron')
const { app, BrowserWindow } = require('electron')
let fs = require("fs")

let config = {}
fs.readFile("data/config.json", (err, arg) => {
  if (err) {
    console.log(err)
    return
  }
  config = JSON.parse(arg.toString())
})

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule:true
    }
  })

  win.loadFile('render/index.html')
  setTimeout(function(){
    win.send("InitPlaylist", config.songs)
  }, 1000)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  config.songs = Array.from(new Set(config.songs))
  fs.writeFile("data/config.json", JSON.stringify(config), (err) => {
    if (err) {
      console.log(err)
    }
  })
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.on('addSong', (event, arg) => {
  if (config.songs.indexOf(arg) < 0) {
    config.songs.push(arg)
  }
})

ipcMain.on('delSong', (event, arg) => {
  if (config.songs[arg.index] == arg.src) {
    config.songs.splice(arg.index, 1)
  }
})