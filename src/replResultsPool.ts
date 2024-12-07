import EventEmitter from 'events';
import { ReplResult } from './utils';

class ReplResultsPool extends EventEmitter {

    /** @type {ReplResultsPool | null} */
    private static _instance: ReplResultsPool | null = null;

    /** @type {ReplResult[]} */
    private results: ReplResult[] | null = [];

    // Private constructor to prevent direct instantiation
    private constructor() {
        super();
    }

    /**
     * Get the singleton instance of the ReplResultsPool.
     * @returns {ReplResultsPool} The singleton instance.
     */
    static get instance(): ReplResultsPool {
        if (!this._instance) {
            this._instance = new ReplResultsPool();
        }
        return this._instance;
    }
    
    /**
     * Clear the results stored in the pool.
     */
    clear(): void {
        this.results = [];
    }


    /**
     * Send new results and emit the 'results' event.
     * @param {ReplResult[]} results The results to store and broadcast.
     */
    send(results: ReplResult[]): void {
        this.results = results || [];
        this.results.length && this.emit('results', results);
    }

    /**
     * Get the current results stored in the pool.
     * @returns {ReplResult[]} The stored results.
     */
    getResults(): ReplResult[] | null {
        return this.results;
    }
}

export default ReplResultsPool;
