const applyFilters = (item, filter) => {
    const abort = -1

    console.log('Filtering item: ', JSON.stringify(item))

    // TODO: Filter block
    if(!!filter) {
        console.log('Applying filters: ', JSON.stringify(filter))

        let {
            type = 'comparison',
            config = null
        } = filter

        if(!config) {
            return abort
        }

        let {
            column = null,
            condition = 'eq',
            value = null,
            action = 'include',
            regex = null
        } = config

        if(!item.hasOwnProperty(column)) {
            return abort
        }

        const columnValue = item[column]

        if(type === 'comparison') {
            if(!column || !value) {
                console.log('column or value null', column, value)

                return abort
            }

            // TODO: What if item[column] is array ?
            if(Array.isArray( columnValue )) {
                console.log('[NOT IMPLEMENTED YET] columnValue is array, skipping filter')

                return abort
            }

            if(condition === 'eq') {
                const cond = columnValue === value

                return action === 'include' ? cond : !cond
            } else if(condition === 'lt') {
                const cond = parseFloat(columnValue) < parseFloat(value)

                return action === 'include' ? cond : !cond
            } else if(condition === 'lte') {
                const cond = parseFloat(columnValue) <= parseFloat(value)

                return action === 'include' ? cond : !cond
            } else if(condition === 'gt') {
                const cond = parseFloat(columnValue) > parseFloat(value)

                return action === 'include' ? cond : !cond
            } else if(condition === 'gte') {
                const cond = parseFloat(columnValue) >= parseFloat(value)

                return action === 'include' ? cond : !cond
            }
        } else if(type === 'match') {
            if(!regex) {
                console.log('match regex null, skipping filter')

                return abort
            }

            const regexp = Function('return ' + regex)()
            const cond = !!columnValue.match(regexp)

            return action === 'include' ? cond : !cond
        } else if(type === '!match') {
            if(!regex) {
                console.log('!match regex null, skipping filter')

                return abort
            }

            const regexp = Function('return ' + regex)()
            const cond = !!columnValue.match(regexp)

            return action === 'include' ? !cond : cond
        }
    }

    return true
}

module.exports = {
    applyFilters
}
