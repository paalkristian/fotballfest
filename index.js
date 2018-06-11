const express = require('express');
const fs = require('fs');
const values = require('object.values');

const app = express();

if (!Object.values) {
    values.shim();
}

// Middlewares
app.use(express.json());

// Data er hentet fra https://github.com/lsv/fifa-worldcup-2018
var worldcupData = JSON.parse(fs.readFileSync("./worldcup2018.json", "utf8"));

let deltakerId = 0;

// {navn: "Esben Aarseth", kamp: "id", id: "id"}
let deltakelser = [];

const rootUrl = process.env.ROOT_URL || 'http://localhost:' + (process.env.PORT || 3001);

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
                .filter(deltakelse => deltakelse.kamp === match.name)
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
    let groupMatches = Object.values(worldcupData.groups).reduce(
        (allMatches, group) => allMatches.concat(Object.values(group.matches)).map(decorateMatchWithLinks).map(addAttendeesToMatch),
        []
    );

    let knockoutMatches = Object.values(worldcupData.knockout).reduce(
        (allMatches, round) => allMatches.concat(Object.values(round.matches)).map(decorateMatchWithLinks).map(addAttendeesToMatch),
        []
    );

    return [...groupMatches, ...knockoutMatches];
};

app.get("/api/matches", (req, res) => {
    res.send({
        matches: matches(),
    });
});

app.get('/api/matches/attendees/:matchId', (req, res) => {
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
    } else if (typeof matches().find(match => match.name === attendance.kamp) === 'undefined') {
        console.log('Kunne ikke finne kamp med id ' + attendance.kamp);
        res.status(400).send({message: `Kunne ikke finne kamp med id ${attendance.kamp}`});
        return false;
    }
    return true;
}

app.post('/api/attendees', (req, res) => {
    const body = req.body;
    if (!validateAttendance(req, res)) {
        return;
    }

    const confirmation = {navn: body.navn, kamp: body.kamp, id: deltakerId++};
    deltakelser.push(confirmation);

    res.status(200).send(confirmation);
});

app.delete('/api/attendees/:id', (req, res) => {
    if (typeof deltakelser.find(deltakelse => deltakelse.id === req.params.id) === 'undefined') {
        res.status(400).send({message: 'Could not find attendance with id: ' + req.params.id});
        return;
    }
    deltakelser = deltakelser.filter(deltakelse => deltakelse.id === req.params.id);
    res.status(204).send();
});

// PORT
const port = process.env.PORT || 3001;

app.listen(port, () => console.log(`Example app listening on port ${port}...`));
