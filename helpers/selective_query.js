/**
 * Generate a selective update query based on a request body
 * @param {String} table - where to make the query
 * @param {Object} items - req.body
 * @param {String} key - username OR handle
 * @param {String} value - string to search table for
 */
function selectivePatchQuery(table, items, key, value) {
  // keep track of item indexes
  let idx = 1;
  // start by updating a table
  let queryPart1 = `UPDATE ${table} SET `;

  // store all the columns we want to update and associate with vals
  let updates = [];
  for (let column in items) {
    updates.push(`${column}=$${idx++}`);
  }

  // add where clause
  let queryPart2 = ` WHERE ${key}=$${idx} RETURNING *`;

  // put it all together
  let query = queryPart1 + updates.join(', ') + queryPart2;
  let values = Object.values(items);
  values.push(value);

  return { query, values };
}

module.exports = { selectivePatchQuery };
