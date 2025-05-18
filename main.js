

customElements.define(
    "cal-week",
    class extends HTMLElement{
        constructor() {
            super()
            let week = document.querySelector("#template-week")
            let shadow = this.attachShadow({mode:"open"})
            shadow.appendChild(week.content.cloneNode(true))
        }
    }
)

customElements.define(
    "cal-day",
    class extends HTMLElement{
        constructor() {
            super()
            let day = document.querySelector("#template-day")
            let shadow = this.attachShadow({mode:"open"})
            shadow.appendChild(day.content.cloneNode(true))
        }
    }
)

customElements.define(
    "cal-entry",
    class extends HTMLElement{
        constructor() {
            super()
            let entry = document.querySelector("#template-entry")
            let shadow = this.attachShadow({mode:"open"})
            shadow.appendChild(entry.content.cloneNode(true))
        }
    }
)

const dayCorrection = (d) => d + 6 % 7

class HTMLCalendar {
    id
    color
    name
    constructor() {
        this.cal = document.getElementById("cal")
    
        this.currentDate = new Date()
        this.currentWeek = new Date()
        this.currentWeek.setDate(this.currentWeek.getDate() - this.currentWeek.getDay())
        
        this.weekOffset = 0

        this.manager = new EntryManager()
        this.populateWeek()
    }

    reset(){
        this.cal.innerHTML = ""
        this.manager.reset()
    }

    prev() {
        this.reset()
        this.weekOffset -= 1
        this.populateWeek()
    }

    next() {
        this.reset()
        this.weekOffset += 1
        this.populateWeek()
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
        const months = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "nov", "Dez"]
        const curr = new Date()
        curr.setDate(curr.getDate() + this.weekOffset * 7 - dayCorrection(curr.getDay()) + day_offset);
        const dayid = HTMLCalendar.getDateId(curr)
        day.setAttribute("id", dayid)

        let weekday = document.createElement("p")
        weekday.setAttribute("slot", "weekday")
        weekday.innerText = curr.getDate()
        day.appendChild(weekday)

        let month = document.createElement("p")
        month.setAttribute("slot", "month")
        month.innerText = curr.getDay() == 1 || curr.getDate() == 1? months[curr.getMonth()] : ""
        day.appendChild(month)

        day.appendChild(this.populateEntry())
    }

    populateEntry(){
        let calentry = document.createElement("cal-entry")
        const textarea = calentry.shadowRoot.querySelector("div > textarea")
        let calendar = this

        textarea.addEventListener("focusin", (event) => {
            //console.log("(focusin)", event.target.value)
            if(event.target.value == ""){
                let dayelem = event.target.getRootNode().host.parentNode//.id
                let elem = calendar.populateEntry()
                dayelem.appendChild(elem)
            }
        })

        textarea.addEventListener("focusout", (event) => {
            console.log("focusout", event.target.value.trim())
            if (event.target.value.trim() == ""){
                event.target.remove()
            }
        })

        textarea.addEventListener("input", (event) => {
            console.log("(input): old_entry ",  event.target.old_entry)
            let elem = event.target
            //console.log(event.target.getRootNode().host.parentNode)//getRootNode().getRootNode().getRootNode())
            
            //console.log("(input) ", entry, elem)
            if(elem.value == ""){
                if (event.target.old_entry == undefined) {
                    // stayed empty
                    // do nothing
                } else {
                    calendar.manager.deleteEntry(event.target.old_entry)
                    event.target.old_entry = undefined
                }
            } else {
                
                let entry = HTMLCalendar.entryFromElement(elem)
                if (event.target.old_entry == undefined){
                    // new element created
                    calendar.manager.registerEntry(entry)
                    // broatcast update
                    calendar.manager.createEntry(entry)
                    event.target.debouncer = debounce((old_entry, new_entry)=>{calendar.manager.updateEntry(old_entry, new_entry)}, 1000)
                } else {
                    // entry updated, broatcast update
                    let old_old_entry = event.target.old_entry
                    event.target.debouncer(old_old_entry, entry)
                }
                //event.target.old_entry = entry
            }
        })
        return calentry
    }

    static entryFromElement(elem) {
        let entry = new Entry().setDate(elem.getRootNode().host.parentNode.id)
                               .setContent(elem.value)
                               .setEndDate(null)
                               .setRepeat(false)
                               .build()
        return entry
    }

    static getDateId(date){
        return `${1900 + date.getYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}`
    }
}

function debounce(foo, timeout) {
    let timer
    return (...args)=>{
        clearTimeout(timer)
        timer = setTimeout(() => {
            foo.apply(this, args)
        }, timeout)
    }
}

class Entry {
    id = undefined
    date = undefined
    end_date = undefined
    content = undefined
    repeat = undefined

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

    static hash(str) {
        const p = 821
        const m = 433024223
        // polynomial rolling hash
        return str.split("").map((c, i) => c.charCodeAt() * (p**i) % m).reduce((a, v)=> a+v % m)
    }

    build() {
        this.id = Entry.hash(this.content)
        return this
    }
    
    repr() {
        return {
            id: this.id,
            date: this.date,
            end_date: this.end_date,
            content: this.content,
            repeat: this.repeat
        }
    }

    fromRepr(repr){
        let loaded = new CalendarEntry().setDate(repr.date)
                                  .setEndDate(repr.end_date)
                                  .setContent(repr.content)
                                  .setRepeat(repr.repeat)
                                  .build()//repr.id)
        if (loaded.id != repr.id) {
            console.error("not the same ids")
        }
        return loaded
    }

    fromAttributes(dateid, end_date, content, repeat){
        return new CalendarEntry().setDate(dateid)
                                  .setEndDate(end_date)
                                  .setContent(content)
                                  .setRepeat(repeat)
                                  .build()
    }
}

class HTMLCalendarEntryBuilder{
    constructor() {

    }

    build(){
        return this
    }
}

class Command {
    static changes = []

    constructor(name, foo, unfoo) {
        this.foo = foo
        this.unfoo = unfoo
    }

    execute() {
        this.foo()
        Command.changes.push(this)
    }

    rollback() {

    }
}

function addEntry(){
    return Command("add", )
}


class EntryManager {
    constructor(){
        this.observer = new StorageObserver()
        this.storageServer = new StorageServer()
        this.storageLocal = new StorageLocal()
    }

    createEntry(entry) {
        // receive new entry from View
        // write new entry to local storage, write to changelog for the server
        
        console.log("new Entry")
    }

    updateEntry(old, entry) {
        // receive new entry from View
        // write updates from entry to local storage and to changelog for the server
        console.log("update Entry", old, entry)
    }

    deleteEntry() {
        // receive entry deletion from View
        // write del entry to local storage and to changelog for the server
        console.log("delete Entry")
    }
    
    registerEntry(entry){
        // register entry
        // so on receive change from server aka fetch
        // entry can be updated, if entry exists
    }

    registerDay(id) {
        // register entry
        // so on receive change from server aka fetch
        // entry can be created, if entry does not exists yet
    }

    reset() {
        // reset registered entries, since they do not need to be upadted when not displayed
    }

    fetch() {
        // fetch data from server
        // notify registered entries and days
        // write changes to localstorage
    }

    push() {
        // send changelog to server
    }
}

class StorageObserver {
    constructor() {}

    registerCallback(id, foo){

    }

    notify() {

    }
}


class StorageLocal {
    static async fetchStorageLocal() {
        let storage = new StorageLocal()
        await storage.init()
        return storage
    }

    init(){
        const request = window.indexedDB.open("calendar", 1)
        request.onupgradeneeded = (event) => {
            this.db = event.target.result
            const store = this.db.createObjectStore("appointments", {autoincrement: false})

            store.createIndex("dateIndex", "dateid", {unique:false, multiEntry:true})
            store.createIndex("entryIndex", {unique:false, multiEntry:true})

            this.db.createObjectStore("keyvalue", {keyPath: "key"})
        }

        request.onsuccess = (event) => {
            this.db = event.target.result
            resolve(request.result)
        }

        request.onerror = (event) => {
            PromiseRejectionEvent(event.target.error)
        }
        return this
    }

    insert(entry) {
        return new Promise((resolve, reject) => {
            const tnx = this.db.transaction(["appointments"], "readonly")
            tnx.onerror = (event) => reject(event.tergat.error)
            const store = tnx.objectStore("appointments")
            const res = store.add(entry.repr())
            
            res.onsuccess = () => resolve(res.result)
            res.onerror = (event) => reject(event.target.error)
        })
    }

    load(entry) {
        return new Promise((resolve, reject) => {
            const tnx = this.db.transaction(["appointments"], "readonly")
            tnx.error = (event) => reject(event.target.error)
            const store = tnx.objectStore("appointments")
            const index = store.index("dateIndex")
            const results = []
            const request = index.openCursor(IDBKeyRange.only(dateid))

            request.onsuccess = (event) => {
                const cursor = event.target.result
                if(cursor) {
                    results.push(cursor.value)
                    cursor.continue()
                } else {
                    resolve(results)
                }
            }

            request.onerror = (event) => reject(event.target.error)
        })
    }

    delete(entry) {

    }

    update(entry) {

    }
}

class StorageServer {
    constructor() {}

    fetch(){

    }

    push() {

    }
}


let calendar = undefined
function main() {
    calendar = new HTMLCalendar()
}
main()