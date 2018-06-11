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

const addDeltakereToMatch = (match) => {
    return Object.assign(
        {
            deltakere: deltakelser
                .filter(deltakelse => deltakelse.kamp === match.name)
                .map(deltakelse => {
                return {
                    navn: deltakelse.navn,
                }
            })
        },
        match
    )
};



const matches = () => {
    let groupMatches = Object.values(worldcupData.groups).reduce(
        (allMatches, group) => allMatches.concat(Object.values(group.matches)).map(addDeltakereToMatch),
        []
    );

    let knockoutMatches = Object.values(worldcupData.knockout).reduce(
        (allMatches, round) => allMatches.concat(Object.values(round.matches)).map(addDeltakereToMatch),
        []
    );

    return  [...groupMatches, ...knockoutMatches];
};

app.get("/api/matches", (req, res) => {
    res.send({
        matches: matches(),
    });
});

app.get('/api/deltakere/:matchId', (req, res) => {
    res.send(matches().filter(match => match.name === req.params.matchId).deltakere);
});

app.post('/api/deltakelser', (req, res) => {
    const body = req.body;
    if (typeof body.navn === 'undefined') {
        res.status(400).send({message: 'deltaker must be defined'});
    } else if (typeof body.kamp === 'undefined') {
        res.status(400).send({message: 'kamp must be defined'});
    }

    deltakelser.push({navn: body.navn, kamp: body.kamp});
    console.log(deltakelser);
    res.status(200).send({deltakelsesId: deltakerId++});
});

app.delete('/api/deltakere/:id', (req, res) => {
    deltakelser = deltakelser.filter(deltakelse => deltakelse.id === req.params.id);
    res.status(204).send();
});

// PORT
const port = process.env.PORT || 3001;

app.listen(port, () => console.log(`Example app listening on port ${port}...`));
