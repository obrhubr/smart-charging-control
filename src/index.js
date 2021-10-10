import * as dotenv from 'dotenv'; 
dotenv.config();
import fetch from 'node-fetch';
import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.urlencoded({ limit: '15mb', extended: false }));

async function request_data() {
    // StartTime and EndTime are spaced apart 15min
    var startTime = new Date();
    startTime = startTime.getFullYear() + '-' + startTime.getMonth() + '-' + startTime.getDate() + '%20' + startTime.getHours() + ':'  + startTime.getMinutes() + ':' + startTime.getSeconds();
    var endTime = new Date(new Date().getTime() + (60 * 1000));
    endTime = endTime.getFullYear() + '-' + endTime.getMonth() + '-' + endTime.getDate() + '%20' + endTime.getHours() + ':'  + endTime.getMinutes() + ':' + endTime.getSeconds();

    // Get data from api
    const response = await fetch(
        'https://monitoringapi.solaredge.com/site/' +
        process.env.SITEID +
        '/powerDetails?meters=PRODUCTION&startTime=' +
        startTime + 
        '&endTime=' +
        endTime +
        '&api_key=' + 
        process.env.TOKEN

        , {method: 'GET'}
    );
    console.log(response);
    const data = await response.json();

    var production = data.powerDetails.meters[0].values[0].value;
    console.log("PRODUCTION: ", production);

    return production;
}

function get_kw(production) {
    return Math.floor((production - 2000) / 1000);
}

async function set_charging(kw) {
    const response = await fetch(
        'http://10.0.0.8:5000/charging-speed/set',
        {
            method: 'POST', 
            body: JSON.stringify({
                "value": kw ?? 0
            }),
            headers: {'Content-Type': 'application/json'}
        }
    );
    const data = await response.json();
    console.log("RESPONSE: ", data);
}

async function set_charging_allowed() {
    const response = await fetch(
        'http://10.0.0.8:5000/charging-allowed/set',
        {
            method: 'POST', 
            body: JSON.stringify({
                "value": 1
            }),
            headers: {'Content-Type': 'application/json'}
        }
    );
    const data = await response.json();
    console.log("SET CHARGING ALLOWED: ", data);
}

// respond with "hello world" when a GET request is made to the homepage
app.post('/manual', function (req, res) {
    var flag = req.body.value;

    if(flag == 0) {
        req.app.locals.manual = 0;
        res.json({"result": "Successfully changed to automatic."});
    } else {
        req.app.locals.manual = 1;
        res.json({"result": "Successfully changed to manual."});
    }
});

app.listen(process.env.PORT, () => { 
    console.log("Server listening on port: " + process.env.PORT);
    app.locals.manual = 0;

    setInterval(async function() {;
        if(app.locals.manual == 0) {
            var kw = await get_kw(await request_data());

            await set_charging(kw);
            await set_charging_allowed();
        }
    }, 15 * 60 * 1000);
});