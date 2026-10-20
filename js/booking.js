// ===== Settings: change these =====
const ACCESS_KEY = "4171495a-93ee-41f9-8ca7-41f476d638b4";   // from web3forms.com (see notes)
const WHATSAPP = "256701887955";                  // no + or spaces
const PHONE_DISPLAY = "+256 701 887 955";

const SPACES = {
    venue: {
        name: "Cedar Park Venue",
        img: "images/cedar-park-venue.jpg",
        about: "A spacious outdoor venue for weddings, conferences, celebrations and large gatherings.",
        facts: ["Large capacity (up to 1000+ people)", "Outdoor setting", "Parking available", "Flexible layouts", "Changing rooms"],
        
    },
    hall: {
        name: "Cedar Park Hall",
        img: "images/cedar-park-hall.jpg",
        about: "A comfortable indoor hall for gatherings, small weddings and meetings of 100 to 250 guests.",
        facts: ["Indoor venue", "Weather protected", "Ideal for meetings", "Modern facilities", "Sound proof"],
        
    },
    unsure: {
        name: "Not sure yet",
        img: "",
        about: "Tell us about your event below and we'll help you choose between the venue and the hall.",
        facts: [],
        
    }
};

const $ = id => document.getElementById(id);
const key = new URLSearchParams(location.search).get("space");
const space = SPACES[key];

// ===== Which state to show =====
if (space) {
    $("chooser").hidden = true;
    $("chosen").hidden = false;

    $("summary").innerHTML =
        (space.img ? `<img src="${space.img}" alt="${space.name}">` : "") +
        `<div>
            <h2>${space.name}</h2>
            <p>${space.about}</p>` +
        (space.facts.length ? `<ul>${space.facts.map(f => `<li>${f}</li>`).join("")}</ul>` : "") +
        (space.price ? `<p class="from">${space.price} <small>(indicative, final price agreed with the manager)</small></p>` : "") +
        `<a class="change-link" href="booking.html">Change space</a>
        </div>`;
}

// ===== Date rules =====
const start = $("startDate");
const end = $("endDate");
const today = new Date().toISOString().split("T")[0];
start.min = today;
end.min = today;

function updateDays() {
    if (start.value) end.min = start.value;
    if (start.value && end.value && end.value < start.value) end.value = start.value;

    if (start.value && end.value) {
        const days = Math.round((new Date(end.value) - new Date(start.value)) / 86400000) + 1;
        $("daysHint").textContent = days + (days === 1 ? " day" : " days") + " selected.";
    }
}
start.addEventListener("change", updateDays);
end.addEventListener("change", updateDays);

// ===== Submit =====
function makeRef() {
    const d = new Date();
    const stamp = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    return "CP-" + stamp + "-" + Math.floor(1000 + Math.random() * 9000);
}

$("enquiryForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("submitBtn");
    const err = $("formError");
    err.hidden = true;

    const clash = findClash(start.value, end.value);
    if (clash) {
        err.textContent = "Sorry, " + niceDate(clash) + " is already booked. Please choose different dates.";
        err.hidden = false;
        return;
    }

    const ref = makeRef();
    const data = Object.fromEntries(new FormData(e.target));
    data.access_key = ACCESS_KEY;
    data.subject = "New booking request " + ref + ": " + space.name;
    data.from_name = "Cedar Park Website";
    data.reference = ref;
    data.space = space.name;

    btn.disabled = true;
    btn.textContent = "Sending...";

    try {
        const res = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);

        $("chosen").hidden = true;
        $("done").hidden = false;
        $("refCode").textContent = ref;
        $("refDetails").textContent = space.name + ", " + data.start_date +
            (data.end_date !== data.start_date ? " to " + data.end_date : "");
        $("waLink").href = "https://wa.me/" + WHATSAPP + "?text=" +
            encodeURIComponent("Hello Cedar Park, my booking request reference is " + ref + ".");
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
        err.textContent = "We couldn't send your booking request. Please try again, or call us on " + PHONE_DISPLAY + ".";
        err.hidden = false;
        btn.disabled = false;
        btn.textContent = "Send booking request";
    }
});
