import fs from 'fs';

function write_offset(offset) {
	let data = JSON.stringify({ offset: offset });
	fs.writeFileSync('offset.json', data);
}

function read_offset() {
	let rawdata = fs.readFileSync('./offset.json');
	let offset = JSON.parse(rawdata);
	return offset.offset;
}

export {
	write_offset,
	read_offset
};