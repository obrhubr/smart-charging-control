import fetch from 'node-fetch';

async function get_charging() {
    const response = await fetch(
        `${process.env.CHARGER_ADRESS}/charging-speed/read`,
        {
            method: 'GET'
        }
    );
    const data = await response.json();

    console.log("CURRENT CHARGING: ", data);
    return data.results.charging_speed_kw;
}

async function set_charging_allowed() {
    const response = await fetch(
        `${process.env.CHARGER_ADRESS}/charging-allowed/set`,
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

async function set_charging(kw) {
    const response = await fetch(
        `${process.env.CHARGER_ADRESS}/charging-speed/set`,
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

    // Allow charging
    await set_charging_allowed()
}

export {
    get_charging,
    set_charging
};