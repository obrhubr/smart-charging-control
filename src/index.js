import * as dotenv from 'dotenv'; 
dotenv.config();
import fs from 'fs';
import fetch from 'node-fetch';
import express from 'express';
import bodyParser from 'body-parser';

let metrics_data = {
    solar_power: 0,
    read_kw: 0,
    set_kw: 0,
    offset: 0
}

const app = express();
app.use(bodyParser.json());

function write_offset(offset) {
    let data = JSON.stringify({ offset: offset });
    fs.writeFileSync('offset.json', data);
}

function read_offset() {
    let rawdata = fs.readFileSync('../offset.json');
    let offset = JSON.parse(rawdata);
    return offset.offset;
}

async function get_timezone_date() {
    // Get data from api
    const response = await fetch(
        "http://worldtimeapi.org/api/timezone/Europe/Vienna"
        , {method: 'GET'}
    );
    const data = await response.json();

    return data.datetime;
}

async function request_data() {
    var real_time = await get_timezone_date();

    // StartTime and EndTime are spaced apart 15min
    var startTime = new Date(real_time);
    startTime = startTime.getFullYear() + '-' + (startTime.getMonth() + 1) + '-' + startTime.getDate() + '%20' + startTime.getHours() + ':'  + startTime.getMinutes() + ':' + startTime.getSeconds();
    var endTime = new Date(new Date().getTime(real_time) + (60 * 1000));
    endTime = endTime.getFullYear() + '-' + (endTime.getMonth() + 1) + '-' + endTime.getDate() + '%20' + endTime.getHours() + ':'  + endTime.getMinutes() + ':' + endTime.getSeconds();

    var url = 'https://monitoringapi.solaredge.com/site/' +
        process.env.SITEID +
        '/powerDetails?meters=FEEDIN,PURCHASED&startTime=' +
        startTime + 
        '&endTime=' +
        endTime +
        '&api_key=' + 
        process.env.TOKEN;

    console.log(url);

    // Get data from api
    const response = await fetch(
        url
        , {method: 'GET'}
    );

    try {
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
    } catch (err) {
        console.log("ERROR API: ", res.text());
        throw err;
    }
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

function get_kw(last_charging_kw_not_corrected, feedin, purchased) {
    var last_charging_kw = last_charging_kw_not_corrected < 4.3 ? 2 : last_charging_kw_not_corrected;-

    console.log("GET KW FORMULA: (last_charging_kw, feedin, purchased) ", last_charging_kw, feedin, purchased);

    var charging_kw = Math.min(Math.max((last_charging_kw + feedin / 1000 - purchased / 1000), 4.2), 8);
    var rounded = Math.round(charging_kw);

    console.log("SETTING TO: (rounded, not rounded) ", rounded, charging_kw);

    return rounded;
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
        console.log("Successfully changed to automatic.");
        res.json({"result": "Successfully changed to automatic."});
    } else {
        req.app.locals.manual = 1;
        console.log("Successfully changed to manual.");
        res.json({"result": "Successfully changed to manual."});
    }
});

app.post('/offset', (req, res) =>  {
    write_offset(req.body.value);

    res.json({ "result": "Successfully changed offset to: " + req.body.value });
})

app.get('/prometheus', (req, res) => {
    res.setHeader('content-type', 'text/plain');
    /*
    # TYPE smc_health gauge
    smc_healt 1

    # TYPE smc_solar_power gauge
    smc_solar_power 9.123

    # TYPE smc_read_kw gauge
    smc_read_kw 9.123

    # TYPE smc_set_kw gauge
    smc_set_kw 9.123

    # TYPE smc_offset gauge
    smc_offset 9.123
    */

    res.send(`# TYPE smc_health gauge\nsmc_health 1\n# TYPE smc_solar_power gauge\nsmc_solar_power ${metrics_data.solar_power}\n# TYPE smc_read_kw gauge\nsmc_read_kw ${metrics_data.read_kw}\n# TYPE smc_set_kw gauge\nsmc_set_kw ${metrics_data.set_kw}\n# TYPE smc_offset gauge\nsmc_offset ${metrics_data.offset}`)
});

app.listen(process.env.PORT, () => { 
    console.log("Server listening on port: " + process.env.PORT);
    app.locals.manual = 0;

    setInterval(async function() {;
        if(app.locals.manual == 0) {
            try {
                console.log("GETTING DATA: ");
                var power = await request_data();
                metrics_data.read_kw(power);
                var current_kw = await get_charging();
    
                var kw = get_kw(current_kw, power[0], power[1]);
                metrics_data.read_kw(kw);
                var offset = read_offset();
                metrics_data.offset = offset;

                await set_charging(kw + offset);
                metrics_data.set_kw(kw + offset);
                await set_charging_allowed();
            } catch (err) {
                console.log("ERR: ", err);
            }
        }
    }, 15 * 60 * 1000);
});