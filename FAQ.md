# F.A.Q

## How to write a `IN` (or `NOT IN`) query ?

As documented [here](https://github.com/brianc/node-postgres/wiki/FAQ#11-how-do-i-build-a-where-foo-in--query-to-find-rows-matching-an-array-of-values),
you can easily replace `col IN (${arrayVariable})` - which will not work - by `col = ANY(${arrayVariable})`, which works even if the array is empty
Same thing for `col NOT IN (${arrayVariable})` that can be replace by `col <> ALL(${arrayVariable})`
