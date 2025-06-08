import { describe, test, expect } from '@jest/globals'
import {
  getNestedProperty,
  setNestedProperty,
  sortObjectRecursively,
  translationExists,
  flattenObject,
} from '../../src/utils/object.js'

describe('Object Utils', () => {
  const testObject = {
    button: {
      save: 'Save',
      cancel: 'Cancel',
    },
    form: {
      validation: {
        required: 'Required',
        email: 'Invalid email',
      },
    },
    simple: 'value',
  }

  describe('getNestedProperty', () => {
    test('should get nested property with dot notation', () => {
      expect(getNestedProperty(testObject, 'button.save')).toBe('Save')
      expect(getNestedProperty(testObject, 'form.validation.required')).toBe(
        'Required'
      )
      expect(getNestedProperty(testObject, 'simple')).toBe('value')
    })

    test('should return undefined for non-existent property', () => {
      expect(
        getNestedProperty(testObject, 'button.nonexistent')
      ).toBeUndefined()
      expect(getNestedProperty(testObject, 'nonexistent.key')).toBeUndefined()
    })

    test('should handle empty object', () => {
      expect(getNestedProperty({}, 'any.key')).toBeUndefined()
    })
  })

  describe('setNestedProperty', () => {
    test('should set nested property with dot notation', () => {
      const obj = {}
      setNestedProperty(obj, 'button.save', 'Save')

      expect(obj).toEqual({
        button: {
          save: 'Save',
        },
      })
    })

    test('should set deeply nested property', () => {
      const obj = {}
      setNestedProperty(obj, 'form.validation.required', 'Required')

      expect(obj).toEqual({
        form: {
          validation: {
            required: 'Required',
          },
        },
      })
    })

    test('should preserve existing properties', () => {
      const obj = { button: { cancel: 'Cancel' } }
      setNestedProperty(obj, 'button.save', 'Save')

      expect(obj).toEqual({
        button: {
          cancel: 'Cancel',
          save: 'Save',
        },
      })
    })

    test('should overwrite existing property', () => {
      const obj = { button: { save: 'Old Save' } }
      setNestedProperty(obj, 'button.save', 'New Save')

      expect(obj.button.save).toBe('New Save')
    })
  })

  describe('sortObjectRecursively', () => {
    test('should sort object keys alphabetically', () => {
      const unsorted = {
        zebra: 'z',
        alpha: 'a',
        beta: 'b',
      }

      const sorted = sortObjectRecursively(unsorted)
      const keys = Object.keys(sorted)

      expect(keys).toEqual(['alpha', 'beta', 'zebra'])
    })

    test('should sort nested objects recursively', () => {
      const unsorted = {
        zebra: {
          gamma: 'g',
          alpha: 'a',
        },
        alpha: {
          beta: 'b',
          alpha: 'a',
        },
      }

      const sorted = sortObjectRecursively(unsorted)

      expect(Object.keys(sorted)).toEqual(['alpha', 'zebra'])
      expect(Object.keys(sorted.alpha)).toEqual(['alpha', 'beta'])
      expect(Object.keys(sorted.zebra)).toEqual(['alpha', 'gamma'])
    })

    test('should handle non-object values', () => {
      expect(sortObjectRecursively('string')).toBe('string')
      expect(sortObjectRecursively(123)).toBe(123)
      expect(sortObjectRecursively(null)).toBe(null)
      expect(sortObjectRecursively([1, 2, 3])).toEqual([1, 2, 3])
    })
  })

  describe('translationExists', () => {
    test('should return true for existing translation', () => {
      expect(translationExists(testObject, 'button.save')).toBe(true)
      expect(translationExists(testObject, 'form.validation.required')).toBe(
        true
      )
    })

    test('should return false for non-existing translation', () => {
      expect(translationExists(testObject, 'button.nonexistent')).toBe(false)
      expect(translationExists(testObject, 'nonexistent.key')).toBe(false)
    })
  })

  describe('flattenObject', () => {
    test('should flatten nested object to dot notation', () => {
      const flattened = flattenObject(testObject)

      expect(flattened).toEqual({
        'button.save': 'Save',
        'button.cancel': 'Cancel',
        'form.validation.required': 'Required',
        'form.validation.email': 'Invalid email',
        simple: 'value',
      })
    })

    test('should handle empty object', () => {
      expect(flattenObject({})).toEqual({})
    })

    test('should handle flat object', () => {
      const flat = { a: 1, b: 2 }
      expect(flattenObject(flat)).toEqual(flat)
    })

    test('should handle arrays as values', () => {
      const obj = { list: [1, 2, 3] }
      expect(flattenObject(obj)).toEqual({ list: [1, 2, 3] })
    })
  })
})
