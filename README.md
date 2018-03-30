# Tx-Diff
---------------
Registers changes on a line by line bases and can apply those changes elsewhere.


### Get Changes

```$xslt
let diff = new diffLib.getDiff(oldText, newText)
```

### Apply Changes
```$xslt
let newText = diffLib.applyChanges(diff, oldText)
```