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
        '/powerDetails?meters=FEEDIN,PURCHASED&startTime=' +
        startTime + 
        '&endTime=' +
        endTime +
        '&api_key=' + 
        process.env.TOKEN

        , {method: 'GET'}
    );
    const data = await response.json();

    var purchased = 0;
    var feedin = 0;

    for(var i = 0; i < 2; i++) {
        if(data.powerDetails.meters[i].type == "Purchased") {
            purchased = data.powerDetails.meters[i].values[0].value;
            console.log("PURCHASED: ", purchased);
        }
        if(data.powerDetails.meters[i].type == "FeedIn") {
            feedin = data.powerDetails.meters[i].values[0].value;
            console.log("FEEDIN: ", feedin);
        }
    }

    return [feedin, purchased];
}

async function get_charging() {
    const response = await fetch(
        'http://10.0.0.8:5000/charging-speed/read',
        {
            method: 'GET'
        }
    );
    const data = await response.json();
    console.log("CURRENT CHARGING: ", data);
    return data.results.charging_speed_kw
}

function get_kw(last_charging_kw, feedin, purchased) {
    var charging_kw = Math.min(Math.max((last_charging_kw + feedin / 1000 - purchased / 1000), 3.5), 8);

    console.log("SETTING TO: ", charging_kw);

    return Math.round(charging_kw);
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
    console.log("CHARGING SET: ", data);
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
            console.log("GETTING DATA: ");
            var power = await request_data();
            var current_kw = await get_charging();

            var kw = get_kw(current_kw, power[0], power[1]);

            await set_charging(kw);
            await set_charging_allowed();
        }
    }, 15 * 60 * 1000);
});