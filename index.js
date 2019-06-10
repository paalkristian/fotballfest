const express = require('express');
const fs = require('fs');
const values = require('object.values');
const auth = require('basic-auth');
const yrno = require("yr.no-forecast")({
    version: "1.9", // this is the default if not provided,
    request: {
        // make calls to locationforecast timeout after 15 seconds
        timeout: 10000,
    },
});

const worldCupData = require('./worldCupData');

const app = express();

if (!Object.values) {
    values.shim();
}

// Middlewares
app.use("/icons", express.static("icons"));
app.use(express.json());

let deltakerId = 0;

// {navn: "Esben Aarseth", kamp: "id", id: "id"}
let deltakelser = [];

const rootUrl = process.env.ROOT_URL || 'http://localhost:' + (process.env.PORT || 3001);

const validateRequest = (req, res) => {
    const user = auth(req);
    if (typeof user === 'undefined') {
        res.status(401).send({message: 'Did you forget to pass basic auth credentials?'});
        return false;
    }
    if (user.name !== 'kontraskjaeret' || user.pass !== 'Sommerjobb2019') {
        res.status(401).send({message: 'Did you pass correct credentials?'});
        return false;
    }
    return true;
};

function createLink(href, method, accepts) {
    return {
        href: href,
        method: method,
        accepts: accepts
    };
}

const decorateDeltakelseWithLinks = (match, deltakelse) => {
    return {
        navn: deltakelse.navn,
        _links: {
            "removeFromAttendees": createLink(`${rootUrl}/api/attendees/${deltakelse.id}`, 'DELETE', 'application/json'),
            "attendeesToSameGame": createLink(`${rootUrl}/api/matches/attendees/${deltakelse.kamp}`, 'GET', 'application/json')
        }
    }
};

const addAttendeesToMatch = (match) => {
    return Object.assign(
        {
            attendees: deltakelser
                .filter(deltakelse => deltakelse.kamp === match.id)
                .map(deltakelse => {
                    return decorateDeltakelseWithLinks(match, deltakelse);
                })
        }, match);
};

const decorateMatchWithLinks = (match) => {
    return Object.assign({
        _links: {
            "attendMatch": createLink(`${rootUrl}/api/attendees`, 'POST', 'application/json')
        }
    }, match);
};

const matches = () => {
    return worldCupData.matches.map(decorateMatchWithLinks).map(addAttendeesToMatch);
};

app.get("/api/matches", (req, res) => {
    if(!validateRequest(req, res)) {
        return;
    }
    res.send({
        matches: matches(),
    });
});


// ******* Deltagere ********

app.get('/api/matches/attendees/:matchId', (req, res) => {
    if(!validateRequest(req, res)) {
        return;
    }
    var matchId = req.params.matchId;
    res.send(matches().filter(match => match.name == matchId).map(match => match.attendees));
});

function validateAttendance(req, res) {
    const attendance = req.body;
    if (typeof attendance.navn !== 'string') {
        console.log('Kunne ikke legge til deltaker ' + attendance.navn);
        res.status(400).send({message: 'deltaker må være av typen string'});
        return false;
    } else if (typeof attendance.kamp !== 'number') {
        console.log('Kamp er udefinert');
        res.status(400).send({message: 'kamp må være definert'});
        return false;
    } else if (typeof matches().find(match => match.id === attendance.kamp) === 'undefined') {
        console.log('Kunne ikke finne kamp med id ' + attendance.kamp);
        res.status(400).send({message: `Kunne ikke finne kamp med id ${attendance.kamp}`});
        return false;
    }
    return true;
}

app.post('/api/attendees', (req, res) => {
    if(!validateRequest(req, res)) {
        return;
    }
    const body = req.body;
    if (!validateAttendance(req, res)) {
        return;
    }

    const confirmation = {navn: body.navn, kamp: body.kamp, id: deltakerId++};
    deltakelser.push(confirmation);

    res.status(200).send(confirmation);
});

app.delete('/api/attendees/:id', (req, res) => {
    if(!validateRequest(req, res)) {
        return;
    }
    if (typeof deltakelser.find(deltakelse => deltakelse.id === req.params.id) === 'undefined') {
        res.status(400).send({message: 'Could not find attendance with id: ' + req.params.id});
        return;
    }
    deltakelser = deltakelser.filter(deltakelse => deltakelse.id === req.params.id);
    res.status(204).send();
});


/* WEATHER */
const KONTRASKJAERET = {
    lat: 59.910341,
    lon: 10.736276,
  };
  
let weatherData = {};
let lastTimeDataWasFetched = new Date(0);

app.get("/api/weather", (req, res) => {
let time = new Date(req.query.time);
if (
    !req.query.time ||
    Object.prototype.toString.call(time) !== "[object Date]" ||
    isNaN(time.getTime())
) {
    const tomorrowAtThisTime = new Date(new Date().setDate(new Date().getDate()+1)).toISOString();
    res
    .status(504)
    .send(
        `APIet krever at en gyldig datostreng blir sendt med requesten på dette formatet: /api/weather?time=${tomorrowAtThisTime}`,
    );
    return;
}
if (new Date() - lastTimeDataWasFetched > 180000) {
    yrno
    .getWeather(KONTRASKJAERET)
    .then(weather => {
        lastTimeDataWasFetched = new Date();
        weatherData = weather;
        respondToRequestForWeather(weatherData, time, res);
    })
    .catch(err => {
        console.log(err);
        res.status(500).send(err);
        return;
    });
} else {
    respondToRequestForWeather(weatherData, time, res);
}
});

function respondToRequestForWeather(weather, forecastTime, res) {
let forecastArray = Object.values(weather.times);
if (
    forecastTime < new Date(forecastArray[0].from) ||
    forecastTime > new Date(forecastArray[forecastArray.length - 1].from)
) {
    res.send({});
    return;
}
let forecast = forecastArray.reduce((acc, val) => {
    if (forecastTime >= new Date(val.from)) {
    return val;
    }
    return acc;
}, {});
forecast.symbolUrl = getSymbolUrl(forecast.symbolNumber);
res.send(forecast);
}

function getSymbolUrl(symbolNumber) {
let symbolString = String(symbolNumber);
if (symbolString.length === 1) {
    symbolString = "0" + symbolString;
}
return "/icons/" + symbolString + ".svg";
}


// PORT
const port = process.env.PORT || 3001;

app.listen(port, () => console.log(`Example app listening on port ${port}...`));
