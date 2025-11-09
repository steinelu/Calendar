
class CalWeek extends HTMLElement{
    constructor() {
        super()
        let week = document.querySelector("#template-week")
        let shadow = this.attachShadow({mode:"open"})
        shadow.appendChild(week.content.cloneNode(true))
    }
}

class CalDay extends HTMLElement{
    constructor() {
        super()
        let day = document.querySelector("#template-day")
        let shadow = this.attachShadow({mode:"open"})
        shadow.appendChild(day.content.cloneNode(true))
    }
}

class CalInput extends HTMLElement{
    constructor() {
        super()
        let entry = document.querySelector("#template-input")
        this.shadow = this.attachShadow({mode:"open"})
        this.shadow.appendChild(entry.content.cloneNode(true))

        this.manager = calendar.manager
        this.eid = (Math.random() + 1).toString(36).substring(7)
        let input = this.shadow.querySelector("div > #inputfield")
        

        input.addEventListener("input", (event) => {
            //this.handleColor()
            let parent = event.target.parentNode.parentNode.host
            
            let entry = Entry.fromCalInput(parent)
            this.debouncedCommit(entry)

            //if (event.target.innerText.trim() == ""){
                //parent.eid = undefined
            //}
        })

        input.addEventListener("focusin", (event) =>  {
            if(event.target.innerText.trim() != "")
                return

            let day = event.target.parentNode.parentNode.host.parentNode
            let input = calendar.populateEntry()
            day.append(input)
        })

        input.addEventListener("focusout", (event) =>  {
            let node =  event.target.parentNode.parentNode.host.parentNode
            
            //console.log(node.lastChild, event.target.innerText.trim())
            if(event.target.innerText.trim() == "")
                node.lastChild.remove()
            
            this.commitNow()
            this.handleColor()
        })
        
        this.addEventListener("dragstart", (event) => {
            calendar.before = Entry.fromCalInput(event.target)
            this.commitNow()

            event.target.classList.add("dragging")
        })

        this.addEventListener("drop", (event) => {
            event.preventDefault()
            let elem = document.querySelector(".dragging")
            this.handleColor()
            let day = event.target.closest("cal-day")
            let prev = event.target.closest("cal-input")
            prev.before(elem)
            
            this.commit(calendar.before.setContent(""))
            
            
            let childs = day.querySelectorAll("cal-input")
            

            for (let input of [...childs]) {
                let elem = Entry.fromCalInput(input)
                this.commit(elem)
            }
            calendar.before = undefined
        })
    
        this.addEventListener("dragend", (event) => {
            event.target.classList.remove("dragging")
        })

        this.addEventListener("dragover", (event) => {
            event.preventDefault()
        })

        return this
    }

    debouncedCommit(entry){
        this.tobecommit = entry

        clearTimeout(this.timer)
        this.timer = setTimeout(
            () => {
                this.commit(entry)
                this.timer = undefined
                this.entryToCommit = undefined
            },
            1000
        )
    }

    commit(entry){
        //console.log(entry, this)
        this.manager.commit(entry)
    }

    commitNow(){
        clearTimeout(this.timer)
        this.timer = undefined
        if(this.tobecommit != undefined)
            this.commit(this.tobecommit)

        this.tobecommit = undefined
    }

    calculatePosition(){
        const pos = [...this.shadowRoot.host.parentNode.children].indexOf(this)
        return pos
    }

    disconnectedCallback() {
        this.commitNow()
    }


    handleColor(){
        let input = this.shadowRoot.getElementById("inputfield")
        let pattern = /(#[0-9a-fA-F]{3,6})\b/g
        let walker = document.createTreeWalker(input, NodeFilter.SHOW_TEXT)
        
        //let selection = document.getSelection()
        
        //let cursorpos = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

        let node = walker.nextNode()

        let matches = []

        while(node) {
            //console.log(node, node.nodeValue)
            let text = node.nodeValue

            let m = [...text.matchAll(pattern)]
            m.forEach(match=>{
                matches.push({
                    node,
                    start: match.index,
                    end: match.index + match[1].length,
                    color:match[1]
                })
            })

            node = walker.nextNode()
        }

        matches.reverse().forEach(({node, start, end, color}) => {
            
            let range = document.createRange()
            range.setStart(node, start)
            range.setEnd(node, end)

            let span = document.createElement("span")
            span.textContent = color
            span.style.backgroundColor = color

            range.deleteContents()
            range.insertNode(span)
        })

        // if (cursorpos) {
        //     selection.removeAllRanges();
        //     selection.addRange(cursorpos);
        // }
        
        /*
        let node = input.firstChild
        console.log(node)

        while ((match = x.exec(input.textContent)) !== null) {
            let range = document.createRange()
            range.setStart(node, match.index)
            range.setEnd(node, match.index + match[1].length)

            let span = document.createElement("span")
            span.style.backgroundColor = match[1]
            span.textContent = match[1]

            range.deleteContents()
            range.insertNode(span)
        }*/
    }
}




const dayCorrection = (d) => (d + 6) % 7

class CalendarManager {
    constructor(){
        this.calendars = []
    }

    appendCalendar(calendar){
        this.calendars.append(calendar)
    }
}

class HTMLCalendar {
    idcnt
    color
    name

    constructor() {
        this.cal = document.getElementById("cal")
    
        this.currentDate = new Date()
        this.currentWeek = new Date()
        this.currentWeek.setDate(this.currentWeek.getDate() - this.currentWeek.getDay())
        
        this.weekOffset = 0
        this.current_weekdays = []
        this.populateWeek()

        this.addControlInputHandlers()
    }

    dump() {
        return this.manager.dump()
    }

    static async fetch(config){
        let cal = new HTMLCalendar()
        cal.manager = await Manager.fetch(config)
        return cal
    }

    reset(){
        this.cal.innerHTML = ""
        this.current_weekdays = []
        //this.manager.reset()
    }

    async prev() {
        this.reset()
        this.weekOffset -= 1
        this.populateWeek()
        this.load()
    }

    async next() {
        this.reset()
        this.weekOffset += 1
        this.populateWeek()
        this.load()
    }

    async load(){
        //console.log("load")
        let promises = []
        for (let dateid of this.current_weekdays){
            
            let batch = await this.manager.load(dateid)
            promises.push(batch)
        }
        let res = await Promise.all(promises)

        for (let batch of res){

            for (let entry of batch.sort((a, b)=>b.pos - a.pos)) {
                if (entry.cmd == "del")
                    continue

                let input = this.populateEntry() // TODO make it nice , purt stuff in func
                input.eid = entry.id
                //input.shadowRoot.querySelector("textarea"). = entry.content
                input.shadowRoot.getElementById("inputfield").innerText = entry.content
                
                input.handleColor()
                let day = document.getElementById(entry.dateid)
                day.prepend(input)
            }
        }
    }

    async push(){
        this.manager.push()
    }

    async fetch(){
        await this.manager.fetch()
        //await this.load()

        this.reset()
        
        this.populateWeek()
        this.load()
    }

    populateWeek(){
        let week = document.createElement("cal-week")
        for (let i = 0; i< 7; i++) {
            let day = document.createElement("cal-day")
            
            this.populateDay(day, i)
            week.appendChild(day)
        }
        this.cal.appendChild(week)
    }

    populateDay(day, day_offset){
        const months = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
        const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
        const curr = new Date()
        curr.setDate(curr.getDate() + this.weekOffset * 7 - dayCorrection(curr.getDay()) + day_offset);
        const dayid = HTMLCalendar.getDateId(curr)
        day.setAttribute("id", dayid)

        if (HTMLCalendar.getDateId(curr) == HTMLCalendar.getDateId(new Date())){
            day.classList.add("today")
        }

        this.current_weekdays.push(dayid)

        let weekday = document.createElement("p")
        weekday.classList.add("daynr")
        weekday.setAttribute("slot", "weekday")

        const wk = days[dayCorrection(curr.getDay())]
        weekday.innerText = wk + " " + curr.getDate()
        day.appendChild(weekday)

        let month = document.createElement("p")
        month.classList.add("month")
        month.setAttribute("slot", "month")
        month.innerText = curr.getDay() == 1 || curr.getDate() == 1? months[curr.getMonth()] : ""
        day.appendChild(month)

        day.appendChild(this.populateEntry())
    }

    populateEntry(){
        let calentry = document.createElement("cal-input")
        return calentry
    }

    static getDateId(date){
        return `${1900 + date.getYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}`
    }

    addControlInputHandlers() {

        this.startX = undefined

        addEventListener('touchstart', (e) => {
            this.startX = e.touches[0].clientX
        })

        addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX
            const swipeThreshold = 50

            if (endX - this.startX > swipeThreshold) {
                calendar.prev()
            } else if (this.startX - endX > swipeThreshold) {
                calendar.next()
            } else {
                //alert('Swipe too short!');
            }
            this.startX=undefined
        })

        addEventListener("keyup", (event) => {
            if(!event.ctrlKey) return
            switch (event.key) {
                case "ArrowLeft":
                    this.prev()
                    break;
                case "ArrowRight":
                    this.next()
                    break;
                default:
                    break;
            }
        })
    }

}

class Entry {
    id = undefined
    date = undefined
    end_date = undefined
    content = undefined
    repeat = undefined
    pos = undefined

    version = undefined

    setDate(date){
        this.date = date
        return this
    }

    setEndDate(end_date){
        this.end_date = end_date
        return this
    }

    setContent(content){
        this.content = content
        return this
    }

    setRepeat(repeat) {
        this.repeat = repeat
        return this
    }

    setPos(pos){
        this.pos = pos
        return this
    }

    static hash(str) {
        const p = 821
        const m = 433024223
        // polynomial rolling hash
        return str.split("").map((c, i) => c.charCodeAt() * (p**i) % m).reduce((a, v)=> a+v % m)
    }

    setId(id){
        this.id = id
        return this
    }

    setVersion(v){
        this.version = v
        return this
    }

    setUpdate(){
        this.cmd = "put"
        return this
    }

    setDelete(){
        this.cmd = "del"
        return this
    }

    build() {
        //this.id = Entry.hash(this.content)
        
        return this
    }
    
    repr() {
        return {
            id: this.id,
            dateid: this.date,
            end_date: this.end_date,
            content: this.content,
            repeat: this.repeat,
            version: this.version,
            cmd: this.cmd,
            pos: this.pos,
        }
    }

    static fromCalInput(elem) {
        //let ta = elem.shadowRoot.querySelector("textarea")
        let ta = elem.shadowRoot.getElementById("inputfield")
        let entry = new Entry().setDate(elem.parentNode.id)
                               .setContent(ta.innerText)
                               .setEndDate(null)
                               .setRepeat(false)
                               .setId(elem.eid)
                               .setVersion(null)
                               .setPos(elem.calculatePosition())
                               .build()
      
        return entry
    }

    static fromRepr(repr){
        let loaded = new Entry().setDate(repr.dateid)
                                  .setEndDate(repr.end_date)
                                  .setContent(repr.content)
                                  .setRepeat(repr.repeat)
                                  .setId(repr.id)
                                  .setPos(repr.pos)
                                  .build()//repr.id) // TODO used?
        return loaded
    }


    fromAttributes(id, dateid, end_date, content, repeat){
        return new CalendarEntry().setDate(dateid)
                                  .setEndDate(end_date)
                                  .setContent(content)
                                  .setRepeat(repeat)
                                  .setId(id)
                                  .build() // TOD used=
    }
}





class Manager {
    static async fetch(config){
        let mngr = new Manager()
        mngr.storageLocal = await StorageLocal.fetch()
        mngr.storageServer = new StorageServer(config)
        return mngr
    }

    constructor(){
        this.version = 0
        this.cid = "temp"
    }

    async dump(){
        let hist = await this.storageLocal.dump()
        let H = []
        for (let h of hist) {
            if (h.cmd != "del") {
                H.push(h)
            }
        }
        let j = JSON.stringify(H, null, 4)
        let b = new Blob([j], {type:"application/json"})
        return b
    }

    commit(entry){
        entry.setVersion(this.version)
        if (entry.content.trim() == "") {
            this.storageLocal.insert(entry.setDelete())
            //this.storageLocal.delete(entry)
        } else {
            this.storageLocal.insert(entry.setUpdate())
        }
    }

    async load(dateid){
        return this.storageLocal.load(dateid)
    }

    async fetch() {
        // fetch data from server
        // write changes to localstorage

        let updates = await this.storageServer.fetch(this.cid, this.version)

        //let batch = await this.manager.fetch()
        
        for (let set of updates){
            for (let entry of set) {
                console.log(entry)
                this.storageLocal.insert(Entry.fromRepr(entry))
            }
        }
    }

    async push() {
        // send changelog to server
        let delta = await this.storageLocal.deltas(this.version)
        console.log(delta)
        return this.storageServer.push(delta, this.cid, this.version)
    }
}

class StorageLocal {
    static async fetch() {
        let storage = new StorageLocal()
        await storage.init()
        return storage
    }

    init(){
        const request = window.indexedDB.open("calendar", 1)
        return new Promise((resolve, reject) => {
                request.onupgradeneeded = (event) => {
                this.db = event.target.result
                const store = this.db.createObjectStore("appointments", {keyPath: "id"})

                store.createIndex("dateIndex", "dateid", {unique:false, multiEntry:true})
                store.createIndex("entryIndex", "id", {unique:true})
                store.createIndex("versionIndex", "version", {unique:false, multiEntry:true})

                this.db.createObjectStore("keyvalue", {keyPath: "key"})
            }

            request.onsuccess = (event) => {
                this.db = event.target.result
                resolve(request.result)
            }

            request.onerror = (event) => {
                PromiseRejectionEvent(event.target.error)
            }})
    }

    insert(entry) {
        return new Promise((resolve, reject) => {
            const tnx = this.db.transaction(["appointments"], "readwrite")
            tnx.onerror = (event) => reject(event.target.error)
            const store = tnx.objectStore("appointments")
            const res = store.put(entry.repr())
            
            res.onsuccess = () => resolve(res.result)
            res.onerror = (event) => reject(event.target.error)
        })
    }

    load(dateid) {
        return new Promise((resolve, reject) => {
            const tnx = this.db.transaction(["appointments"], "readonly")
            tnx.onerror = (event) => reject(handleError(event.target.error))
            const store = tnx.objectStore("appointments")
            const index = store.index("dateIndex")
            
            const request = index.getAll(IDBKeyRange.only(dateid))
            request.onsuccess = (event) => {
                resolve(request.result)
            }
            request.onerror = (event) => reject(handleError(event.target.error))
        })
    }

    delete(entry) {
        return new Promise((resolve, reject) => {
            const tnx = this.db.transaction(["appointments"], "readwrite")
            tnx.onerror = (event) => reject(event.target.error)
            const store = tnx.objectStore("appointments")
            const res = store.delete(entry.id)
            
            res.onsuccess = () => resolve(res.result)
            res.onerror = (event) => reject(event.target.error)
        })
    }

    deltas(version){
        return new Promise((resolve, reject) => {
            const tnx = this.db.transaction(["appointments"], "readonly")
            tnx.onerror = (event) => reject(handleError(event.target.error))
            const store = tnx.objectStore("appointments")
            const index = store.index("dateIndex")
            
            const request = index.getAll(IDBKeyRange.lowerBound(version))
            request.onsuccess = () => {
                resolve(request.result)
            }
            request.onerror = (event) => reject(handleError(event.target.error))
        })
    }

    dump(){
        return new Promise((resolve, reject) => {
            const tnx = this.db.transaction(["appointments"], "readonly")
            tnx.onerror = event => reject(handleError(event.target.error))
            const store = tnx.objectStore("appointments")
            const values = []
            const cursor = store.openCursor()

            cursor.onerror = (event) => reject(handleError(event.target.error))
            cursor.onsuccess = (event) => {
                const cur = event.target.result
                if (cur) {
                    values.push(cur.value)
                    cur.continue()
                    
                } else {
                    resolve(values)
                }
            }
        })
    }
}

function handleError(error){
    console.log("Error", error)
}

class Config {
    constructor(){
        this.scheme = "http"
        this.domain = "http://localhost"
        this.port = 5000
    }

    load(){
        // TODO load from config file
    }

    setServer(domain, port){
        this.domain = domain
        this.port = port
        return this
    }

    getURL(){
        let url = new URL(this.domain)
        url.port = this.port
        return url
    }
}

class StorageServer {
    constructor(config) {
        this.config = config
    }

    createUrl(cid, version){
        let url = this.config.getURL()
        url.pathname = `${cid}/${version}`
        return url
    }

    async fetch(cid, version){
        let url = this.createUrl(cid, version)
        let data = null
        //console.log("fetch", url.toString())
        await fetch(url, {
            method: "GET",
            cache: 'no-store',
            //headers:{},
            //body:""
        }).then((resp)=>{
            data = resp.json()
        }).catch((err)=>console.log(err))
        
        return data
    }

    async push(delta, cid, version) {
        let url = this.createUrl(cid, version)
        
        let r = fetch(url,  {
            method: "POST",
            //headers:{},
            body:JSON.stringify(delta),
            cache: 'no-store'
        })
        .then((data) => {
            return data
        }).catch((err)=>console.log(err))
        
        /*const res = await fetch(url, {
            method: "POST",
            //headers:{},
            body:delta
        })

        return await res.json()*/
    }
}


let calendar = undefined
async function main() {
    let config = new Config()
    calendar = await HTMLCalendar.fetch(config)

    customElements.define("cal-week",CalWeek)
    customElements.define("cal-day", CalDay)
    customElements.define("cal-input", CalInput)

    calendar.load()
}
main()