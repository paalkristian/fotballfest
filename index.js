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

const decorateDeltakelseWithLinks = (match, deltakelse) => {
    return {
        navn: deltakelse.navn,
        _links: {
            "removeFromAttendees": {
                "href": `${rootUrl}/api/attendees/${deltakelse.id}`,
                "method": 'DELETE',
                "accepts": 'application/json'
            },
            "attendeesToSameGame": {
                "href": `${rootUrl}/api/matches/attendees/${deltakelse.kamp}`,
                "method": 'GET',
                "accepts": 'application/json'
            }
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
        },
        match
    )
};



const matches = () => {
    let groupMatches = Object.values(worldcupData.groups).reduce(
        (allMatches, group) => allMatches.concat(Object.values(group.matches)).map(addAttendeesToMatch),
        []
    );

    let knockoutMatches = Object.values(worldcupData.knockout).reduce(
        (allMatches, round) => allMatches.concat(Object.values(round.matches)).map(addAttendeesToMatch),
        []
    );

    return  [...groupMatches, ...knockoutMatches];
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

app.post('/api/attendees', (req, res) => {
    const body = req.body;
    if (typeof body.navn === 'undefined') {
        console.log('Deltaker er udefinert');
        res.status(400).send({message: 'deltaker must be defined'});
    } else if (typeof body.kamp === 'undefined') {
        console.log('Kamp er udefinert');
        res.status(400).send({message: 'kamp must be defined'});
    } else if (typeof matches().find(match => match.name === body.kamp) === 'undefined') {
        console.log('Kunne ikke finne kamp med id ' + body.kamp);
        res.status(400).send({message: `Failed to find kamp with id ${body.kamp}`});
    }

    const confirmation = {navn: body.navn, kamp: body.kamp, id: deltakerId++};
    deltakelser.push(confirmation);

    res.status(200).send(confirmation);
});

app.delete('/api/attendees/:id', (req, res) => {
    if(typeof deltakelser.find(deltakelse => deltakelse.id === req.params.id) === 'undefined') {
        res.status(400).send({message: 'Could not find attendance with id: ' + req.params.id});
        return;
    };
    deltakelser = deltakelser.filter(deltakelse => deltakelse.id === req.params.id);
    res.status(204).send();
});

// PORT
const port = process.env.PORT || 3001;

app.listen(port, () => console.log(`Example app listening on port ${port}...`));
