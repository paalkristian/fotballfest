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

const groupMatches = Object.values(worldcupData.groups).reduce(
    (allMatches, group) => allMatches.concat(Object.values(group.matches)),
    []
);

const knockoutMatches = Object.values(worldcupData.knockout).reduce(
    (allMatches, round) => allMatches.concat(Object.values(round.matches)),
    []
);

let matches = [...groupMatches, ...knockoutMatches];

app.get("/api/matches", (req, res) => {
    res.send({
        matches: matches,
    });
});

// PORT
const port = process.env.PORT || 3001;

app.listen(port, () => console.log(`Example app listening on port ${port}...`));
